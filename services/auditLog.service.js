import AuditLog from "../models/AuditLog.js";

const sanitize = (value) => {
  if (!value || typeof value !== "object") return value;
  const json = JSON.parse(JSON.stringify(value));
  const removeSecrets = (node) => {
    if (!node || typeof node !== "object") return;
    Object.keys(node).forEach((key) => {
      if (/(password|token|secret|authorization|otp)/i.test(key)) {
        delete node[key];
      } else {
        removeSecrets(node[key]);
      }
    });
  };
  removeSecrets(json);
  return json;
};

export const createAuditLog = async ({
  userId,
  userName,
  action,
  module,
  referenceId,
  referenceNo,
  description,
  oldData,
  newData,
  details,
  req,
}) => {
  if (!action || !module) return null;

  const user = userId || req?.user?._id;
  if (!user) return null;

  return AuditLog.create({
    user,
    userName: userName || req?.user?.name || req?.user?.email || "System",
    action,
    module,
    referenceId,
    referenceNo,
    description: description || `${action} ${module}`,
    oldData: sanitize(oldData),
    newData: sanitize(newData),
    details: sanitize(details),
    ipAddress: req?.ip || req?.headers?.["x-forwarded-for"],
    userAgent: req?.headers?.["user-agent"],
  });
};
