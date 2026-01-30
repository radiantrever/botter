"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsPayClient = void 0;
const axios_1 = __importDefault(require("axios"));
class TsPayClient {
    baseUrl = 'https://tspay.uz/api/v1';
    async createTransaction(amount, redirectUrl, comment) {
        const accessToken = process.env.TSPAY_SHOP_TOKEN;
        if (!accessToken)
            throw new Error('TSPAY_SHOP_TOKEN is missing');
        try {
            console.log(`TsPay: Creating transaction for ${amount} UZS...`);
            const response = await axios_1.default.post(`${this.baseUrl}/transactions/create/`, {
                amount,
                access_token: accessToken,
                redirect_url: redirectUrl,
                comment: comment
            });
            return response.data;
        }
        catch (error) {
            console.error('TsPay Create Error:', error.response?.data || error.message);
            throw new Error('Failed to create TsPay transaction');
        }
    }
    async checkTransaction(transactionId) {
        const accessToken = process.env.TSPAY_SHOP_TOKEN;
        if (!accessToken)
            throw new Error('TSPAY_SHOP_TOKEN is missing');
        try {
            console.log(`TsPay: Checking transaction ${transactionId}...`);
            const response = await axios_1.default.get(`${this.baseUrl}/transactions/${transactionId}/`, {
                params: {
                    access_token: accessToken
                }
            });
            console.log('TsPay Check Response:', JSON.stringify(response.data, null, 1));
            return response.data;
        }
        catch (error) {
            console.error('TsPay Check Error:', error.response?.data || error.message);
            // Don't throw here, return something the caller can handle or let caller catch
            throw error;
        }
    }
}
exports.TsPayClient = TsPayClient;
