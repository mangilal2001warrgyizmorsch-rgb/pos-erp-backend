import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { cancelSale } from '../controllers/saleController.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';

Sale.findById = jest.fn();
mongoose.connection = { client: { topology: { description: { type: 'Single' } } } };

describe('Sale Controller Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cancelSale', () => {
    it('should return 404 if sale not found', async () => {
      Sale.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      });

      const req = { params: { id: 'invalid_id' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await cancelSale(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Sale not found'
      });
    });

    it('should return 400 if sale is already cancelled', async () => {
      Sale.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue({ status: 'cancelled' })
      });

      const req = { params: { id: 'valid_id' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await cancelSale(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Sale is already cancelled'
      });
    });
  });
});
