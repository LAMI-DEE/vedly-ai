// controllers/whatsappController.js
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../config/db.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const userSessions = new Map(); // Temporary memory bank to hold active conversations

export const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED: Meta successfully connected to Vendly AI!');
            res.status(200).send(challenge);
        } else {
            console.error('❌ WEBHOOK VERIFICATION FAILED: Token mismatch');
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Missing parameters');
    }
};

const getBusinessContext = async (phoneNumber) => {
    const userRes = await query(`
        SELECT u.id as user_id, u.business_id, u.name as user_name, b.name as business_name
        FROM Users u
        JOIN Businesses b ON u.business_id = b.id
        WHERE u.phone_number = $1 AND u.status = 'ACTIVE'
    `, [phoneNumber]);

    if (userRes.rows.length === 0) return null;

    const user = userRes.rows[0];

    // NEW: Count the total staff for this specific business
    const staffCountRes = await query(`SELECT COUNT(*) FROM Users WHERE business_id = $1`, [user.business_id]);
    user.total_staff = Number(staffCountRes.rows[0].count);

    // 1. Fetch live inventory
    // 1. Fetch live inventory
    const inventoryRes = await query(`
        SELECT 
            p.id, p.item_name, p.base_unit_name, p.total_base_stock, p.base_selling_price, p.product_type,
            (
                SELECT json_agg(json_build_object('packaging_name', pp.packaging_name, 'multiplier', pp.multiplier, 'selling_price', pp.selling_price))
                FROM Product_Packaging pp WHERE pp.product_id = p.id
            ) as packaging_options
        FROM Products p WHERE p.business_id = $1 AND p.is_active = TRUE
    `, [user.business_id]);

    // 2. The Rolling Window Cheat Sheet: Today, Yesterday, 7 Days, 30 Days
    const metricsRes = await query(`
        SELECT 
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_revenue,
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN total_amount ELSE 0 END), 0) as yesterday_revenue,
            COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN total_amount ELSE 0 END), 0) as seven_days_revenue,
            COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN total_amount ELSE 0 END), 0) as thirty_days_revenue
        FROM Sales_Ledger WHERE business_id = $1
    `, [user.business_id]);

    const expenseRes = await query(`
        SELECT 
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN amount ELSE 0 END), 0) as today_expenses,
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN amount ELSE 0 END), 0) as yesterday_expenses,
            COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as seven_days_expenses,
            COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as thirty_days_expenses
        FROM Expenses_Ledger WHERE business_id = $1
    `, [user.business_id]);

    // 3. The Receipt Book: Exactly what items were sold today
    const itemsSoldToday = await query(`
        SELECT p.item_name, SUM(sl.quantity_sold_base) as total_qty, SUM(sl.total_amount) as total_naira
        FROM Sales_Ledger sl
        JOIN Products p ON sl.product_id = p.id
        WHERE sl.business_id = $1 AND DATE(sl.created_at) = CURRENT_DATE
        GROUP BY p.item_name
    `, [user.business_id]);

    const metrics = metricsRes.rows[0];
    const expenses = expenseRes.rows[0];

    return { 
        user: user, 
        inventory: inventoryRes.rows,
        analytics: {
            today: { 
                revenue: Number(metrics.today_revenue), 
                expenses: Number(expenses.today_expenses), 
                profit: Number(metrics.today_revenue) - Number(expenses.today_expenses), 
                items_sold: itemsSoldToday.rows 
            },
            yesterday: { 
                revenue: Number(metrics.yesterday_revenue), 
                expenses: Number(expenses.yesterday_expenses), 
                profit: Number(metrics.yesterday_revenue) - Number(expenses.yesterday_expenses) 
            },
            last_7_days: { 
                revenue: Number(metrics.seven_days_revenue), 
                expenses: Number(expenses.seven_days_expenses), 
                profit: Number(metrics.seven_days_revenue) - Number(expenses.seven_days_expenses) 
            },
            last_30_days: { 
                revenue: Number(metrics.thirty_days_revenue), 
                expenses: Number(expenses.thirty_days_expenses), 
                profit: Number(metrics.thirty_days_revenue) - Number(expenses.thirty_days_expenses) 
            }
        }
    };
};

const getGeminiResponse = async (senderPhone, userText) => {
    let retries = 3;
    while (retries > 0) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const context = await getBusinessContext(senderPhone);

            if (!context) {
                return "Good day. I am Vedly AI. It appears this phone number is not registered to an active business account. Please contact support to set up your profile.";
            }

            let chat;
            if (userSessions.has(senderPhone)) {
                chat = userSessions.get(senderPhone);
            } else {
                chat = model.startChat({
                    history: [
                        {
                            role: "user",
                            parts: [{ 
                                text: `You are Vedly AI, an elite, highly intelligent executive ERP assistant for a Nigerian SME. 
                                The user chatting with you is ${context.user.user_name}, the owner/staff of ${context.user.business_name}.
                                
                                CURRENT CONTEXT:
                                - Location: Nigeria. All currency MUST be formatted in Naira (₦).
                                - Live Inventory Data: ${JSON.stringify(context.inventory)}
                                - The Live Inventory Data includes a 'product_type' for every item. Use this to accurately answer if a user asks what physical goods, dropship items, or services you offer.
                                - Today's Financial Analytics: ${JSON.stringify(context.analytics)}
                                
                                YOUR PERSONA:
                                You are Vedly AI, a highly intelligent, fast, and natural Nigerian business assistant. 
                                IMPORTANT CONTEXT: You are currently talking to ${context.user.user_name}. The business they work at is ${context.user.business_name}. There are currently ${context.user.total_staff} registered staff members at this business.
                                
                                - BE HUMAN: Talk like a sharp, friendly human colleague. Stop sounding like a robotic customer care agent.
                                - NO ROBOT-SPEAK: NEVER use cliche phrases like "Is there anything else I can help you with?", "My pleasure to assist", or "Thank you for letting me know". Just be direct and natural.
                                - NAME DROPPING: Use the user's name RARELY only when necessary. Do not use it in every single message.
                                - TONE: Warm, Naija-friendly .

                                CRITICAL SYSTEM INSTRUCTION: 
                                1. You have 'packaging_options'. A carton contains a 'multiplier' amount of the base unit.
                                2. If asked about stock, calculate how many cartons AND loose base units they have left.

                                3. LOGGING A SALE: Include this secret code block. Your JSON MUST match your math!
                                - Example Base Unit: [ACTION: {"type": "SALE", "id": "uuid", "qty": 5, "is_package": false, "customer": "Mr. Kunle"}]
                                - Example Package: [ACTION: {"type": "SALE", "id": "uuid", "qty": 2, "is_package": true, "package_name": "carton"}]
                                - OVERRIDE PRICE (CUSTOM PRICE): If the user states how much they collected (e.g., "Sold for 1500" or "friend price 35k"), include it: [ACTION: {"type": "SALE", "id": "uuid", "qty": 1, "is_package": false, "total_amount": 1500}]
                                - OVERRIDE COST (SUPPLIER PRICE JUMP): If the user specifically mentions how much they bought it for TODAY or the supplier cost for this specific sale, include it: [ACTION: {"type": "SALE", "id": "uuid", "qty": 1, "override_cost": 23000}]
                                - IF OVERRIDE COST IS USED: You MUST output the ACTION block, but in your natural text reply, you MUST also warmly ask: "Should I update your standard cost price to this new amount permanently, or is this just a one-off?"
                                - NEGATIVE STOCK CHECK: If the 'product_type' is 'PHYSICAL', check 'total_base_stock'. If they try to sell MORE than the stock, DO NOT output the ACTION block. Tell them stock is insufficient. 
                                - INFINITE STOCK: If the 'product_type' is 'SERVICE' or 'DROPSHIP', it has INFINITE stock. Ignore stock limits entirely and log the sale!
                                
                                4. LOGGING AN EXPENSE & COMPOUND ACTIONS: 
                                - For expenses, include this secret code block: [ACTION: {"type": "EXPENSE", "amount": 5000, "description": "Fuel"}]
                                - COMPOUND ACTIONS (CRITICAL): If the user mentions making a sale AND incurring an expense in the same sentence (e.g., "Sold a shirt for 10k but spent 2k on delivery"), you MUST output BOTH the SALE action block and the EXPENSE action block in the same message. Do not ignore the expense!
                                
                                5. NAIJA SLANG & DATA RULES: 
                                - Understand Nigerian Pidgin natively. Convert slang amounts to pure numbers ("5k" = 5000). NEVER put commas or letters in the JSON 'amount'.
                                
                                6. AMBIGUITY: If the item or unit is unclear, DO NOT guess. Warmly ask them to clarify.
                                
                                7. QUERY HISTORY: Output this exact secret block so the system can search the database:
                                [ACTION: {"type": "SEARCH_HISTORY", "customer": "Mr. Kunle", "item": "Milo"}]
                                
                                8. SUPER ADMIN QUERY: ONLY use this if they ask for BACKEND PLATFORM METRICS (e.g., "How many businesses are registered?" or "What is our total user count?"). 
                                
                                9. IDENTITY/GENERAL CHAT: If the user asks "Who are you?", "What is Vendly AI?", or just says "Hello", DO NOT output an ACTION block. Just reply naturally as Vendly AI, the smart WhatsApp business assistant here to track sales, inventory, and expenses amogst other things.
                                
                                10. REVERSALS & UNDOS: If a user explicitly asks to cancel, delete, or undo a transaction they *just* logged:
                                - For a sale: [ACTION: {"type": "UNDO_LAST_SALE"}]
                                - For an expense: [ACTION: {"type": "UNDO_LAST_EXPENSE"}]

                                11. MISSING PRICES (0 NAIRA): If the 'Live Inventory Data' shows a selling_price of 0 or null for an item, DO NOT log the sale yet. Politely tell the user the item doesn't have a price in the system. Ask them how much they sold it for, and ask if you should update the database with this new price.
                                
                                12. UPDATING PRICES: If the user tells you to set, update, or save a new price for an item, output this block:
                                - Base Unit: [ACTION: {"type": "UPDATE_PRICE", "id": "uuid", "new_price": 500, "is_package": false, "package_name": null}]
                                - Package: [ACTION: {"type": "UPDATE_PRICE", "id": "uuid", "new_price": 6000, "is_package": true, "package_name": "carton"}]
                                (Note: You can output an UPDATE_PRICE block AND a SALE block in the exact same message if they confirm both!)
                                
                                13. WEB DASHBOARD GUIDE (CUSTOMER SUPPORT):
                                You are also the official customer support agent for the Vedly AI platform. If the user asks how to do something on the app/website, use this knowledge to help them:
                                - ACCESSING THE DASHBOARD: Users can log in at the Vedly Web Dashboard using their WhatsApp number to receive an OTP. 
                                - ROLES & PERMISSIONS: There are two roles: 'SME_OWNER' (Store Owner) and 'SME_STAFF' (Sales Staff). Only SME_OWNERs can log into the web dashboard to see analytics. Staff members can only use WhatsApp to log the different  buisness activities.
                                - DELETING/DEMOTING OWNERS: The system strictly prevents users from deleting, suspending, or demoting the *last active* SME_OWNER. To demote yourself, you must first promote another staff member to SME_OWNER on the Team page.
                                - INVENTORY UPLOAD: Users can add products one-by-one or use the 'Import CSV' button on the Inventory page to upload hundreds of products at once.
                                - TEAM MANAGEMENT: To add a new shop boy or staff, the Owner must go to the 'Team' page on the dashboard and click 'Add Staff'. 
                                - GRAPHS & EXPORTS: The dashboard shows Net Profit, Revenue, and Expenses with a visual Area Chart. Owners can filter by Today, Last 7 Days, or Last 30 Days.
                                
                                14. AUTO-CREATING PRODUCTS (NOT IN INVENTORY):
                                If the user logs a sale for an item completely MISSING from the 'Live Inventory Data':
                                - STEP 1: DO NOT log a sale yet. Ask them: "I don't have [Item Name]. Should I create it? Is it Physical, Service, or Dropship?"
                                - STEP 2: Once they confirm the type, you MUST output BOTH the ADD_PRODUCT block AND the SALE block in the EXACT SAME message so the database can process them together.
                                Example format:
                                [ACTION: {"type": "ADD_PRODUCT", "item_name": "Oud Perfume", "base_unit": "bottle", "product_type": "DROPSHIP"}]
                                [ACTION: {"type": "SALE", "id": "NEW_PRODUCT_PLACEHOLDER", "qty": 1, "is_package": false, "total_amount": 800}]` //
                            }],
                        },
                        {
                            role: "model",
                            parts: [{ text: `Understood. I am at your service, ${context.user.user_name}. I have loaded the live inventory and await your instructions.` }],
                        },
                    ],
                });
                userSessions.set(senderPhone, chat);
            }

            // 🚀 NEW: Exponential Backoff Retry Logic
        let retries = 3;
        let delay = 1000; // Start with 1 second delay

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await chat.sendMessage(userText);
                return result.response.text(); // If it works, return immediately
            } catch (error) {
                // If it's a 503 error AND we have retries left
                if (error.status === 503 && attempt < retries) {
                    console.log(`⚠️ Gemini API congested (503). Retrying attempt ${attempt + 1} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Double the wait time for the next attempt (1s -> 2s -> 4s)
                } else {
                    // If it's a different error, or we ran out of retries, throw it
                    console.error(`❌ Gemini API completely failed after ${attempt} attempts:`, error);
                    throw error;
                }
            }
        }
            // const result = await chat.sendMessage(userText);
            // return result.response.text();

        } catch (error) {
            if (error.status === 429 && retries > 1) {
                console.log(`⏳ Rate limit hit! Pausing for 30 seconds... (${retries - 1} attempts left)`);
                await sleep(30000); 
                retries--;
            } else {
                console.error("❌ Gemini API Error:", error);
                return "My apologies, I am experiencing a temporary connection delay. Please give me a moment.";
            }
        }
    }
};

// The Blue Tick Engine
const markMessageAsRead = async (messageId) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v25.0/${process.env.LIVE_PHONE_ID}/messages`,
            { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
            { headers: { 'Authorization': `Bearer ${process.env.META_API_TOKEN}`, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.log('⚠️ Failed to send read receipt');
    }
};

export const sendWhatsAppMessage = async (recipientPhone, messageText) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v25.0/${process.env.LIVE_PHONE_ID}/messages`,
            { messaging_product: 'whatsapp', to: recipientPhone, type: 'text', text: { body: messageText } },
            { headers: { 'Authorization': `Bearer ${process.env.META_API_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Auto-reply sent to ${recipientPhone}`);
    } catch (error) {
        // console.log('❌ Failed to send auto-reply:', error.response ? error.response.data : error.message);
        console.error("❌ Failed to send message to", to);
            // This will print the EXACT reason Meta rejected it!
            if (error.response && error.response.data) {
                console.error("META ERROR DETAILS:", JSON.stringify(error.response.data, null, 2));
            } else {
                console.error(error.message);
            }
    }
};

export const receiveMessage = (req, res) => {
    if (req.body.object === 'whatsapp_business_account') {
        req.body.entry.forEach(entry => {
            const changes = entry.changes[0].value;
            
            if (changes.statuses && changes.statuses.length > 0) {
                const status = changes.statuses[0];
                console.log(`🚦 MESSAGE STATUS: ${status.status}`);
            }

            if (changes.messages && changes.messages.length > 0) {
                const message = changes.messages[0];
                const senderPhone = message.from;
                const isText = message.type === 'text';
                const messageText = isText ? message.text.body : `[Received ${message.type} message]`; 
                
                console.log(`📩 NEW MESSAGE FROM ${senderPhone}: ${messageText}`);

                // Send the Blue Tick instantly
                markMessageAsRead(message.id);

                if (isText) {
                    // It's a text message, send it to the AI brain!
                    getGeminiResponse(senderPhone, messageText).then(async (aiReply) => {
                        
                        // 1. Strip all secret codes out to create the clean user message
                        let finalMessageToUser = aiReply.replace(/\[ACTION:\s*({.*?})\]/g, '').trim();
                        
                        // 2. Extract ALL actions into an array using a Regex Loop
                        const actionRegex = /\[ACTION:\s*({.*?})\]/g;
                        let match;
                        const actions = [];
                        
                        while ((match = actionRegex.exec(aiReply)) !== null) {
                            try {
                                actions.push(JSON.parse(match[1]));
                            } catch (err) {
                                console.error("❌ Error parsing action JSON:", err);
                            }
                        }

                        // 3. Check if ANY of the actions require waiting for a database search
                        const needsToWait = actions.some(a => a.type === "SEARCH_HISTORY" || a.type === "SUPER_ADMIN_QUERY");

                        // 4. FIRE MESSAGE INSTANTLY! (Unless waiting for DB)
                        if (!needsToWait && finalMessageToUser.length > 0) {
                            sendWhatsAppMessage(senderPhone, finalMessageToUser);
                        }

                        // Add this right BEFORE your loop starts
                        let newlyCreatedProductId = null;
                        // 5. LOOP THROUGH AND EXECUTE EVERY ACTION IN THE BACKGROUND
                        for (const actionData of actions) {
                            try {
                                console.log("⚙️ SERVER EXECUTING ACTION:", actionData.type);

                                if (actionData.type === "SALE") {
                                    const userRes = await query(`SELECT id, business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];
                                        let actualQtyToDeduct = actionData.qty;
                                        let defaultTotalAmount = 0;
                                        let defaultTotalCost = 0; // 🚀 NEW: Start tracking cost
                                        let itemName = "Item";
                                        const customerName = actionData.customer || "Walk-in";

                                        // The ID Safety Swap
                                        let productId = actionData.id;
                                        if (productId === "NEW_PRODUCT_PLACEHOLDER" || productId === "uuid" || productId.length < 10) {
                                            if (newlyCreatedProductId) {
                                                productId = newlyCreatedProductId;
                                            } else {
                                                console.error("❌ SALE Error: Invalid Product ID and no new product was created.");
                                                continue; 
                                            }
                                        }

                                        // 1. Calculate Standard DB Pricing & Names
                                        if (actionData.is_package && actionData.package_name) {
                                            // 🚀 NEW: Added pp.cost_price to the SELECT query
                                            const pkgRes = await query(`
                                                SELECT pp.multiplier, pp.selling_price, pp.cost_price, p.item_name 
                                                FROM Product_Packaging pp JOIN Products p ON p.id = pp.product_id
                                                WHERE pp.product_id = $1 AND pp.packaging_name ILIKE $2
                                            `, [productId, actionData.package_name + '%']);
                                            
                                            if (pkgRes.rows.length > 0) {
                                                const pkg = pkgRes.rows[0];
                                                itemName = `${actionData.qty} ${actionData.package_name}(s) of ${pkg.item_name}`;
                                                actualQtyToDeduct = actionData.qty * pkg.multiplier;
                                                defaultTotalAmount = actionData.qty * pkg.selling_price;
                                                defaultTotalCost = actionData.qty * (pkg.cost_price || 0); // 🚀 NEW
                                            }
                                        } else {
                                            // 🚀 NEW: Added base_cost_price to the SELECT query
                                            const prodRes = await query(`SELECT base_selling_price, base_cost_price, item_name FROM Products WHERE id = $1`, [productId]);
                                            if (prodRes.rows.length > 0) {
                                                const product = prodRes.rows[0];
                                                itemName = `${actionData.qty} base unit(s) of ${product.item_name}`;
                                                actualQtyToDeduct = actionData.qty;
                                                defaultTotalAmount = actionData.qty * product.base_selling_price;
                                                defaultTotalCost = actionData.qty * (product.base_cost_price || 0); // 🚀 NEW
                                            }
                                        }

                                        // 2. Silent Override Logic for BOTH Revenue and Cost!
                                        const finalTotalAmount = actionData.total_amount || defaultTotalAmount;
                                        const finalTotalCost = actionData.override_cost || defaultTotalCost;

                                        // 3. Deduct stock ONLY IF it's a PHYSICAL item
                                        const productRes = await query(`SELECT product_type FROM Products WHERE id = $1`, [productId]);
                                        if (productRes.rows.length > 0 && productRes.rows[0].product_type === 'PHYSICAL') {
                                            await query(`UPDATE Products SET total_base_stock = total_base_stock - $1 WHERE id = $2`, [actualQtyToDeduct, productId]);
                                        }

                                        // 4. Insert the sale WITH the Historical Cost Snapshot
                                        await query(`
                                            INSERT INTO Sales_Ledger (business_id, product_id, logged_by_user_id, quantity_sold_base, total_amount, total_cost, customer_name) 
                                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                                        `, [user.business_id, productId, user.id, actualQtyToDeduct, finalTotalAmount, finalTotalCost, customerName]);
                                        
                                        console.log(`✅ DB UPDATED: Sold ${itemName} for ₦${finalTotalAmount}. (Cost recorded: ₦${finalTotalCost})`);
                                        
                                        // 5. LOG THIS TO THE AUDIT TRAIL
                                        await query(`
                                            INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
                                            VALUES ($1, $2, 'AGENT', $3)
                                        `, [user.business_id, user.id, `Recorded a sale of ₦${finalTotalAmount} for ${itemName}.`]);
                                    }
                                }
                                else if (actionData.type === "EXPENSE") {
                                    const userRes = await query(`SELECT id, business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];
                                        await query(`
                                            INSERT INTO Expenses_Ledger (business_id, logged_by_user_id, amount, description) 
                                            VALUES ($1, $2, $3, $4)
                                        `, [user.business_id, user.id, actionData.amount, actionData.description]);
                                        console.log(`✅ DB UPDATED: Logged expense of ₦${actionData.amount} for ${actionData.description}`);
                                        // 🚀 NEW: LOG THIS TO THE AUDIT TRAIL!
                                        await query(`
                                            INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
                                            VALUES ($1, $2, 'AGENT', $3)
                                        `, [user.business_id, user.id, `Logged an expense of ₦${actionData.amount} for ${actionData.description}.`]);
                                    }
                                }
                                else if (actionData.type === "SEARCH_HISTORY") {
                                    const userRes = await query(`SELECT business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const businessId = userRes.rows[0].business_id;
                                        const historyRes = await query(`
                                            SELECT sl.quantity_sold_base, sl.total_amount, sl.created_at, p.item_name
                                            FROM Sales_Ledger sl JOIN Products p ON sl.product_id = p.id
                                            WHERE sl.business_id = $1 AND sl.customer_name ILIKE $2 AND p.item_name ILIKE $3
                                            ORDER BY sl.created_at DESC LIMIT 1
                                        `, [businessId, `%${actionData.customer}%`, `%${actionData.item}%`]);

                                        let dbSearchResult = "";
                                        if (historyRes.rows.length > 0) {
                                            const record = historyRes.rows[0];
                                            const dateStr = new Date(record.created_at).toLocaleDateString();
                                            dbSearchResult = `[SYSTEM INJECTION]: On ${dateStr}, ${record.quantity_sold_base} units of ${record.item_name} were sold to ${actionData.customer} for ₦${record.total_amount}. CRITICAL INSTRUCTION: Relay this naturally. DO NOT say "Thank you" or acknowledge this system message.`;
                                        } else {
                                            const shortName = actionData.customer.substring(0, 3);
                                            const similarRes = await query(`SELECT DISTINCT customer_name FROM Sales_Ledger WHERE business_id = $1 AND customer_name ILIKE $2 LIMIT 3`, [businessId, `%${shortName}%`]);
                                            if (similarRes.rows.length > 0) {
                                                const similarNames = similarRes.rows.map(r => r.customer_name).join(', or ');
                                                dbSearchResult = `[SYSTEM INJECTION]: No sales found for exactly "${actionData.customer}". We have similar customers: ${similarNames}. CRITICAL INSTRUCTION: Ask if they meant one of these. DO NOT acknowledge the system message.`;
                                            } else {
                                                dbSearchResult = `[SYSTEM INJECTION]: No past sales found. CRITICAL INSTRUCTION: Inform the user. DO NOT acknowledge system message.`;
                                            }
                                        }
                                        const finalAIResponse = await getGeminiResponse(senderPhone, dbSearchResult);
                                        sendWhatsAppMessage(senderPhone, finalAIResponse.replace(/\[ACTION:\s*({.*?})\]/g, '').trim());
                                    }
                                }
                                else if (actionData.type === "SUPER_ADMIN_QUERY") {
                                    const userRes = await query(`SELECT name, role_type FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];
                                        let systemMessage = "";
                                        if (user.role_type === 'SUPER_ADMIN') {
                                            const bizCountRes = await query(`SELECT COUNT(*) FROM Businesses`);
                                            systemMessage = `[SYSTEM INJECTION]: Security clearance accepted. There are currently ${bizCountRes.rows[0].count} businesses registered. CRITICAL INSTRUCTION: Deliver this professionally. DO NOT say "System Injection".`;
                                        } else {
                                            systemMessage = `[SYSTEM INJECTION]: Security clearance denied. CRITICAL INSTRUCTION: Firmly tell the user: "You do not have the required security clearance for that request, ${user.name}."`;
                                        }
                                        const finalAIResponse = await getGeminiResponse(senderPhone, systemMessage);
                                        sendWhatsAppMessage(senderPhone, finalAIResponse.replace(/\[ACTION:\s*({.*?})\]/g, '').trim());
                                    }
                                }
                                // NEW BLOCK: HANDLE THE 15-MINUTE QUICK UNDO
                                else if (actionData.type === "UNDO_LAST_SALE") {
                                    const userRes = await query(`SELECT id, business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];

                                        // 1. Find the LAST sale (Joined with Products so we can get the item name for the audit log!)
                                        const lastSaleRes = await query(`
                                            SELECT s.id, s.product_id, s.quantity_sold_base, s.total_amount, p.item_name 
                                            FROM Sales_Ledger s
                                            JOIN Products p ON s.product_id = p.id
                                            WHERE s.business_id = $1 AND s.logged_by_user_id = $2
                                              AND s.created_at >= NOW() - INTERVAL '15 minutes'
                                            ORDER BY s.created_at DESC
                                            LIMIT 1
                                        `, [user.business_id, user.id]);

                                        if (lastSaleRes.rows.length > 0) {
                                            const sale = lastSaleRes.rows[0];

                                            // 2. Put the stock back on the shelf
                                            await query(`UPDATE Products SET total_base_stock = total_base_stock + $1 WHERE id = $2`, [sale.quantity_sold_base, sale.product_id]);

                                            // 3. Rip up the receipt (Delete from Ledger)
                                            await query(`DELETE FROM Sales_Ledger WHERE id = $1`, [sale.id]);

                                            // 🚀 4. NEW: LOG THE REVERSAL TO THE AUDIT TRAIL!
                                            await query(`
                                                INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
                                                VALUES ($1, $2, 'AGENT', $3)
                                            `, [user.business_id, user.id, `Reversed a sale of ₦${sale.total_amount} for ${sale.quantity_sold_base} unit(s) of ${sale.item_name}.`]);

                                            console.log(`⏪ ACTION REVERSED: Restored ${sale.quantity_sold_base} units of ${sale.item_name}`);
                                            
                                            // 💡 FIX: Notice there is NO "systemMessage" here anymore! 
                                            // The AI already naturally told the user "I cancelled it" in its first reply, so we stay silent.

                                        } else {
                                            // 5. FAILED: Over 15 mins or no sale exists
                                            // Since the AI already confidently said "I cancelled it", we MUST force it to apologize and correct itself.
                                            const systemMessage = `[SYSTEM INJECTION]: The user tried to cancel a sale, but the 15-minute window passed or no sale exists in the database. 
                                            CRITICAL INSTRUCTION: Politely inform the user that you can only cancel records via WhatsApp if they were logged within the last 15 minutes. Guide them step-by-step: Tell them to ask the Admin to log into the Vedly Web Dashboard, navigate to the 'Settings' page on the left menu, open the 'Audit & Ledger' tab, click the red trash can icon next to the record, and enter the security code to permanently delete it.`;

                                            const finalAIResponse = await getGeminiResponse(senderPhone, systemMessage);
                                            sendWhatsAppMessage(senderPhone, finalAIResponse.replace(/\[ACTION:\s*({.*?})\]/g, '').trim());
                                        }
                                    }
                                }
                                else if (actionData.type === "UPDATE_PRICE") {
                                    // The AI wants to permanently update a price
                                    if (actionData.is_package && actionData.package_name) {
                                        await query(
                                            `UPDATE Product_Packaging SET selling_price = $1 WHERE product_id = $2 AND packaging_name ILIKE $3`, 
                                            [actionData.new_price, actionData.id, actionData.package_name + '%']
                                        );
                                    } else {
                                        await query(
                                            `UPDATE Products SET base_selling_price = $1 WHERE id = $2`, 
                                            [actionData.new_price, actionData.id]
                                        );
                                    }
                                    console.log(`✅ DB UPDATED: Price updated to ₦${actionData.new_price} for item ${actionData.id}`);
                                }
                                else if (actionData.type === "ADD_PRODUCT") {
                                    const userRes = await query(`SELECT id, business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];
                                        const { item_name, base_unit, product_type } = actionData;
                                        const initialStock = product_type === 'PHYSICAL' ? 0 : null;

                                        // 🚀 NEW: Added RETURNING id to capture the generated UUID
                                        const insertRes = await query(`
                                            INSERT INTO Products (business_id, item_name, base_unit_name, total_base_stock, base_cost_price, base_selling_price, product_type, needs_web_setup)
                                            VALUES ($1, $2, $3, $4, 0, 0, $5, TRUE)
                                            RETURNING id
                                        `, [user.business_id, item_name, base_unit || 'unit', initialStock, product_type]);

                                        // 🚀 NEW: Save the ID to memory for the SALE block to use!
                                        newlyCreatedProductId = insertRes.rows[0].id;
                                        console.log(`✅ DB UPDATED: AI Auto-Created ${product_type} product: ${item_name}`);
                                    }
                                }
                                // NEW BLOCK: HANDLE 15-MINUTE EXPENSE UNDO
                                else if (actionData.type === "UNDO_LAST_EXPENSE") {
                                    const userRes = await query(`SELECT id, business_id FROM Users WHERE phone_number = $1`, [senderPhone]);
                                    if (userRes.rows.length > 0) {
                                        const user = userRes.rows[0];

                                        const lastExpRes = await query(`
                                            SELECT id, amount, description 
                                            FROM Expenses_Ledger 
                                            WHERE business_id = $1 AND logged_by_user_id = $2
                                              AND created_at >= NOW() - INTERVAL '15 minutes'
                                            ORDER BY created_at DESC
                                            LIMIT 1
                                        `, [user.business_id, user.id]);

                                        if (lastExpRes.rows.length > 0) {
                                            const exp = lastExpRes.rows[0];

                                            // Delete it
                                            await query(`DELETE FROM Expenses_Ledger WHERE id = $1`, [exp.id]);

                                            // Log the reversal
                                            await query(`
                                                INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
                                                VALUES ($1, $2, 'AGENT', $3)
                                            `, [user.business_id, user.id, `Reversed an expense of ₦${exp.amount} for ${exp.description}.`]);

                                            console.log(`⏪ ACTION REVERSED: Deleted expense of ₦${exp.amount}`);
                                        } else {
                                            const systemMessage = `[SYSTEM INJECTION]: The user tried to cancel an expense, but the 15-minute window passed or no expense exists. 
                                            CRITICAL INSTRUCTION: Politely inform the user that you can only cancel records via WhatsApp if they were logged within the last 15 minutes. Guide them step-by-step: Tell them to ask the Admin to log into the Vedly Web Dashboard, navigate to the 'Settings' page on the left menu, open the 'Audit & Ledger' tab, click the red trash can icon next to the record, and enter the security code to permanently delete it.`;

                                            const finalAIResponse = await getGeminiResponse(senderPhone, systemMessage);
                                            sendWhatsAppMessage(senderPhone, finalAIResponse.replace(/\[ACTION:\s*({.*?})\]/g, '').trim());
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error("❌ Action Execution Error:", error);
                            }
                        } // End of For Loop
                    });
                }
                else if (message.type === 'reaction') {
                    // THE TINY FIX: The user just reacted (👍, ❤️, etc.) to a message.
                    // We log it in the terminal so we know, but we DO NOT send a reply.
                    console.log(`👍 REACTION FROM ${senderPhone}: Ignored silently.`);
                } else {
                    // EDGE CASE E: It's a voice note, image, sticker, or document
                    const mediaWarning = "Hi, Sorry! I am currently trained to only read text messages. Please type out your sale or expense for me so I can log it properly! ✍🏾";
                    sendWhatsAppMessage(senderPhone, mediaWarning);
                }
            }
        });
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};

