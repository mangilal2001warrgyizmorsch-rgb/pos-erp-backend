import { PDFParse } from "pdf-parse";

/**
 * Parses a bank statement PDF buffer and extracts transaction rows.
 * Supports HDFC, ICICI, SBI, and Axis styles, falling back to a generic regex table parser.
 */
export const parseBankStatementPDF = async (pdfBuffer) => {
  try {
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer), verbosity: 0 });
    await parser.load();
    const textResult = await parser.getText();
    const text = textResult?.text || "";
    
    if (!text || text.trim().length === 0) {
      throw new Error("The PDF document appears to be scanned or contains no extractable text. Please upload a digital text-based PDF statement.");
    }

    const detectedBank = autoDetectBank(text);
    const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
    const transactions = [];

    // Date patterns:
    // 1. DD/MM/YYYY or DD-MM-YYYY (e.g., 25/12/2025 or 25-12-2025)
    // 2. DD MMM YYYY (e.g., 25 Dec 2025 or 25-Dec-2025)
    const dateRegex = /\b(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})\b/;

    // Let's iterate and extract matching lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(dateRegex);

      if (dateMatch) {
        const rawDateStr = dateMatch[0];
        
        // Parse the date safely
        const txDate = parseDateString(rawDateStr);
        if (!txDate || isNaN(txDate.getTime())) {
          continue; // Not a valid transaction line
        }

        // The date is found. Let's isolate the narration and amounts in the line.
        // We look for numbers at the end of the line representing Debit, Credit, and Balance.
        // Match numbers with commas, decimals, and optional DR/CR suffixes
        // Example matches: "45,000.00", "500.00", "1,240.50dr", "340.00 Cr"
        const numberRegex = /(-?\d{1,3}(?:,\d{3})*\.\d{2})(?:\s*(?:dr|cr|DR|CR))?/g;
        const lineAfterDate = line.substring(line.indexOf(rawDateStr) + rawDateStr.length).trim();
        
        const numbersFound = [...lineAfterDate.matchAll(numberRegex)].map(m => {
          let val = parseFloat(m[1].replace(/,/g, ""));
          const textAfter = lineAfterDate.substring(m.index + m[0].length).toLowerCase();
          
          // Check for explicit debit/credit markings in the number itself (e.g. 500.00dr)
          if (m[0].toLowerCase().includes("dr") || m[0].toLowerCase().includes("cr")) {
            const isDr = m[0].toLowerCase().includes("dr");
            return { value: val, isDr, isExplicit: true };
          }
          
          return { value: val, isDr: false, isExplicit: false };
        });

        // Narration is the text between the date and the first number
        let narration = lineAfterDate;
        if (numbersFound.length > 0) {
          const firstNumIndex = lineAfterDate.search(numberRegex);
          if (firstNumIndex !== -1) {
            narration = lineAfterDate.substring(0, firstNumIndex).trim();
          }
        }

        // Clean up narration (remove trailing hyphens, slashes, or reference columns)
        narration = narration.replace(/^[-/\s]+|[-/\s]+$/g, "").trim();
        if (!narration) {
          narration = "Bank Transaction";
        }

        let debit = 0;
        let credit = 0;
        let balance = 0;

        if (numbersFound.length >= 3) {
          // Format: [Debit, Credit, Balance] or [Credit, Debit, Balance]
          // Let's determine which is Debit vs Credit.
          // In standard statements, withdrawals/debits are usually listed before deposits/credits.
          // Or one of them is 0/empty. Let's inspect the values.
          const val1 = numbersFound[0].value;
          const val2 = numbersFound[1].value;
          const val3 = numbersFound[2].value;

          balance = val3;

          // Check heuristics or keywords to identify Debit vs Credit
          if (isDebitNarration(narration)) {
            debit = val1 || val2;
            credit = val1 && val2 ? val2 : 0;
          } else {
            credit = val2 || val1;
            debit = val1 && val2 ? val1 : 0;
          }
        } else if (numbersFound.length === 2) {
          // Format: [Amount, Balance]
          const amount = numbersFound[0].value;
          balance = numbersFound[1].value;

          // Determine if Amount is Debit or Credit
          if (isDebitNarration(narration) || line.toLowerCase().includes("dr") || line.toLowerCase().includes("debit")) {
            debit = amount;
          } else {
            credit = amount;
          }
        } else if (numbersFound.length === 1) {
          // Format: [Amount] (No balance column detected)
          const amount = numbersFound[0].value;
          if (isDebitNarration(narration)) {
            debit = amount;
          } else {
            credit = amount;
          }
        }

        // Avoid adding rows where both Debit and Credit are 0
        if (debit > 0 || credit > 0) {
          transactions.push({
            date: txDate,
            narration,
            debit: Math.abs(debit),
            credit: Math.abs(credit),
            balance: balance || 0
          });
        }
      }
    }
    let finalTransactions = transactions;
    if (transactions.length === 0) {
      finalTransactions = genericHeuristicLineParser(lines);
    }

    return { transactions: finalTransactions, detectedBank };
  } catch (error) {
    throw new Error(`Failed to parse bank statement: ${error.message}`);
  }
};

/**
 * Fallback parser that processes consecutive lines when tabular rows are split across lines.
 */
export const genericHeuristicLineParser = (lines) => {
  const transactions = [];
  const dateRegex = /\b(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})\b/;
  const numberRegex = /(-?\d{1,3}(?:,\d{3})*\.\d{2})(?:\s*(?:dr|cr|DR|CR))?/gi;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      const rawDateStr = dateMatch[0];
      const txDate = parseDateString(rawDateStr);
      if (!txDate || isNaN(txDate.getTime())) {
        i++;
        continue;
      }

      let narrationParts = [];
      let numbersFound = [];

      // Check current line after date
      const lineAfterDate = line.substring(line.indexOf(rawDateStr) + rawDateStr.length).trim();
      
      const extractNumbers = (text) => {
        const matches = [...text.matchAll(numberRegex)];
        return matches.map(m => {
          let val = parseFloat(m[1].replace(/,/g, ""));
          const suffix = m[0].toLowerCase();
          const isDr = suffix.includes("dr") ? true : (suffix.includes("cr") ? false : null);
          return { value: val, isDr };
        });
      };

      const currentLineNumbers = extractNumbers(lineAfterDate);
      numbersFound.push(...currentLineNumbers);

      let currentLineNarration = lineAfterDate;
      if (currentLineNumbers.length > 0) {
        const firstNumIndex = lineAfterDate.search(numberRegex);
        if (firstNumIndex !== -1) {
          currentLineNarration = lineAfterDate.substring(0, firstNumIndex).trim();
        }
      }
      if (currentLineNarration) {
        narrationParts.push(currentLineNarration);
      }

      // Check next few lines (up to 3) for matching narration and numbers
      let j = i + 1;
      let linesConsumed = 0;
      while (j < lines.length && linesConsumed < 3) {
        const nextLine = lines[j];
        if (nextLine.match(dateRegex)) {
          break; // Stop if another date is encountered
        }

        const nextLineNumbers = extractNumbers(nextLine);
        if (nextLineNumbers.length > 0) {
          numbersFound.push(...nextLineNumbers);
          const firstNumIndex = nextLine.search(numberRegex);
          const beforeNum = nextLine.substring(0, actorIndex(firstNumIndex)).trim();
          // Safe boundary helper instead of actorIndex:
          function actorIndex(val) { return val === -1 ? nextLine.length : val; }
          if (beforeNum) {
            narrationParts.push(beforeNum);
          }
        } else {
          if (nextLine.trim().length > 0 && !nextLine.toLowerCase().includes("page") && !nextLine.toLowerCase().includes("statement")) {
            narrationParts.push(nextLine.trim());
          }
        }
        j++;
        linesConsumed++;
      }

      let narration = narrationParts.join(" ").replace(/^[-/\s]+|[-/\s]+$/g, "").trim();
      narration = narration.replace(/\s+/g, " ");
      if (!narration) {
        narration = "Bank Transaction";
      }

      let debit = 0;
      let credit = 0;
      let balance = 0;

      if (numbersFound.length >= 3) {
        const val1 = numbersFound[0].value;
        const val2 = numbersFound[1].value;
        const val3 = numbersFound[2].value;

        balance = val3;
        if (isDebitNarration(narration) || numbersFound[0].isDr === true) {
          debit = val1;
          credit = val2;
        } else {
          credit = val1;
          debit = val2;
        }
      } else if (numbersFound.length === 2) {
        const amount = numbersFound[0].value;
        balance = numbersFound[1].value;

        const isDr = numbersFound[0].isDr;
        if (isDr === true || (isDr === null && isDebitNarration(narration))) {
          debit = amount;
        } else {
          credit = amount;
        }
      } else if (numbersFound.length === 1) {
        const amount = numbersFound[0].value;
        const isDr = numbersFound[0].isDr;
        if (isDr === true || (isDr === null && isDebitNarration(narration))) {
          debit = amount;
        } else {
          credit = amount;
        }
      }

      if (debit > 0 || credit > 0) {
        transactions.push({
          date: txDate,
          narration,
          debit: Math.abs(debit),
          credit: Math.abs(credit),
          balance: balance || 0
        });
        i = j - 1;
      }
    }
    i++;
  }
  return transactions;
};

/**
 * Detects bank names in statement text.
 */
export const autoDetectBank = (text) => {
  if (!text) return null;
  const upper = text.toUpperCase();
  const bankKeywords = [
    { name: "HDFC", matches: ["HDFC"] },
    { name: "SBI", matches: ["STATE BANK OF INDIA", "SBI"] },
    { name: "ICICI", matches: ["ICICI"] },
    { name: "AXIS", matches: ["AXIS BANK"] },
    { name: "KOTAK", matches: ["KOTAK MAHINDRA", "KOTAK"] },
    { name: "PNB", matches: ["PUNJAB NATIONAL BANK", "PNB"] },
    { name: "BOB", matches: ["BANK OF BARODA", "BOB"] },
    { name: "IDFC", matches: ["IDFC FIRST", "IDFC"] },
    { name: "FEDERAL", matches: ["FEDERAL BANK"] },
    { name: "YES BANK", matches: ["YES BANK"] }
  ];

  for (const bank of bankKeywords) {
    for (const match of bank.matches) {
      if (upper.includes(match)) {
        return bank.name;
      }
    }
  }
  return null;
};

/**
 * Parses diverse date formats into standard JS Date.
 */
const parseDateString = (dateStr) => {
  const cleanStr = dateStr.replace(/[-.]/g, "/"); // Standardize separators to slashes
  const parts = cleanStr.split("/");

  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000; // Handle 2-digit years

    let month = 0;
    if (isNaN(parseInt(monthStr, 10))) {
      // Month is word (e.g. Dec, Jan)
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      month = months.indexOf(monthStr.toLowerCase().substring(0, 3));
    } else {
      month = parseInt(monthStr, 10) - 1; // 0-indexed
    }

    if (day > 0 && day <= 31 && month >= 0 && month < 12) {
      return new Date(year, month, day);
    }
  }
  return null;
};

/**
 * Checks narration keywords to classify withdrawal vs deposit.
 */
const isDebitNarration = (narration) => {
  const lower = narration.toLowerCase();
  
  // Standard debit signals
  const debitKeywords = [
    "upi/dr", "withdrawal", "payment to", "transfer to", "debit", "charges", 
    "rent", "salary to", "purchase", "swiggy", "zomato", "amazon", "netflix", 
    "paid", "dr", "chq", "cheque paid", "atm w/d", "card payment"
  ];

  return debitKeywords.some(kw => lower.includes(kw));
};

/**
 * Standardizes bank narration by stripping routing tags, dates, txn numbers, and punctuation.
 */
export const cleanNarration = (narration) => {
  return String(narration || "")
    .toUpperCase()
    .replace(/\b[A-Z0-9]{10,16}\b/g, "")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, "")
    .replace(/\b(UPI|IMPS|NEFT|RTGS|NACH|ACH|BY|TO|DR|CR|TXN|TRANSFER|REFUND|CASH|W\/D|DEBIT|CREDIT|CHQ|REF)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};
