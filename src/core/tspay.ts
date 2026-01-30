import axios from 'axios';

interface CreateTransactionResponse {
    status: string;
    transaction: {
        id: number;
        cheque_id: string;
        payment_url: string;
        status: string;
    };
}

interface CheckTransactionResponse {
    status: string;
    // Possible response variants
    data?: {
        id: number;
        amount: number;
        pay_status: string;
    };
    transaction?: {
        id: number;
        amount: number;
        pay_status: string;
    };
    // Flattened variant
    pay_status?: string;
    id?: number;
    amount?: number;
    payment_type?: string;
}

export class TsPayClient {
    private baseUrl = 'https://tspay.uz/api/v1';

    async createTransaction(amount: number, redirectUrl: string, comment: string): Promise<CreateTransactionResponse> {
        const accessToken = process.env.TSPAY_SHOP_TOKEN;
        if (!accessToken) throw new Error('TSPAY_SHOP_TOKEN is missing');

        try {
            console.log(`TsPay: Creating transaction for ${amount} UZS...`);
            const response = await axios.post(`${this.baseUrl}/transactions/create/`, {
                amount,
                access_token: accessToken,
                redirect_url: redirectUrl,
                comment: comment
            });
            return response.data;
        } catch (error: any) {
            console.error('TsPay Create Error:', error.response?.data || error.message);
            throw new Error('Failed to create TsPay transaction');
        }
    }

    async checkTransaction(transactionId: string): Promise<CheckTransactionResponse> {
        const accessToken = process.env.TSPAY_SHOP_TOKEN;
        if (!accessToken) throw new Error('TSPAY_SHOP_TOKEN is missing');

        try {
            console.log(`TsPay: Checking transaction ${transactionId}...`);
            const response = await axios.get(`${this.baseUrl}/transactions/${transactionId}/`, {
                params: {
                    access_token: accessToken
                }
            });

            console.log('TsPay Check Response:', JSON.stringify(response.data, null, 1));
            return response.data;
        } catch (error: any) {
            console.error('TsPay Check Error:', error.response?.data || error.message);
            // Don't throw here, return something the caller can handle or let caller catch
            throw error;
        }
    }
}
