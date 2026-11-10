import express from 'express';
import { requestRegisterOTP, verifyRegisterOTP, requestLoginOTP, verifyLoginOTP, getStaff, addStaff, logoutTenant, updateProfile, updatePassword, editStaff, toggleStaffStatus, deleteStaff, getStaffStats, sendWelcomeInvite } from '../controllers/tenantController.js';
import { addProduct , getInventory, deleteProduct, editProduct, importInventory, getPendingSetupProducts} from '../controllers/inventoryController.js';
import { logSale, getRecentSales, deleteSale, deleteLedgerRecord, getLedgerHistory } from '../controllers/ledgerController.js';
import { getDashboardSummary, getFinancialStatement } from '../controllers/analyticsController.js';
import { logExpense } from '../controllers/expenseController.js';
import { saveChatMessage, getChatHistory } from '../controllers/chatController.js';
import { getGlobalMetrics, toggleBusinessStatus } from '../controllers/adminController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// 🔓 PUBLIC ROUTES (No Token Required)
// ==========================================
router.post('/auth/register/request-otp', requestRegisterOTP);
router.post('/auth/register/verify', verifyRegisterOTP);
router.post('/auth/login/request-otp', requestLoginOTP);
router.post('/auth/login/verify', verifyLoginOTP);

// ==========================================
// 🔒 PROTECTED ROUTES (verifyToken Required)
// ==========================================

// Auth & Settings
router.post('/logout', verifyToken, logoutTenant);
router.put('/settings/profile', verifyToken, updateProfile);
router.put('/settings/password', verifyToken, updatePassword);

// Team Management
router.get('/team/list', verifyToken, getStaff);
router.post('/team/add', verifyToken, addStaff);
router.get('/team/stats', verifyToken, getStaffStats);
router.put('/team/edit', verifyToken, editStaff); 
router.put('/team/status', verifyToken, toggleStaffStatus); 
router.delete('/team/remove', verifyToken, deleteStaff);
router.post('/team/welcome', verifyToken, sendWelcomeInvite); // 🚀 NEW! 

// Inventory Management
router.post('/inventory/add', verifyToken, addProduct);
router.get('/inventory/list', verifyToken, getInventory);
router.put('/inventory/edit', verifyToken, editProduct);
router.post('/inventory/import', verifyToken, importInventory);
router.delete('/inventory/remove', verifyToken, deleteProduct);
router.get('/inventory/pending-setup', verifyToken, getPendingSetupProducts);

// Ledger & Sales
router.post('/sales/log', verifyToken, logSale);
router.get('/sales/recent', verifyToken, getRecentSales); // 👈 Secured!
router.delete('/sale', verifyToken, deleteSale); // 👈 The new Safe Delete Engine Room!
router.delete('/ledger/record', verifyToken, deleteLedgerRecord);
router.get('/ledger/history', verifyToken, getLedgerHistory);

// Analytics & Dashboard
router.get('/analytics/dashboard', verifyToken, getDashboardSummary); // 👈 Secured!
router.get('/analytics/statement', verifyToken, getFinancialStatement); // 👈 Secured!

// Expenses
router.post('/expenses/log', verifyToken, logExpense);

// Chat & Audit
router.post('/chat/save', verifyToken, saveChatMessage);
router.get('/chat/history', verifyToken, getChatHistory);

// Super Admin
router.get('/admin/metrics', verifyToken, getGlobalMetrics); // 👈 Secured!
router.put('/admin/tenant/status', verifyToken, toggleBusinessStatus);

export default router;