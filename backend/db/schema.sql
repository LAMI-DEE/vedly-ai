-- Enable UUID generation in PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: The Tenants (Businesses)
CREATE TABLE Businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: The Humans (Users/Staff)
CREATE TABLE Users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    business_id UUID REFERENCES Businesses(id) ON DELETE CASCADE,
    role_type VARCHAR(50) NOT NULL, -- 'SUPER_ADMIN', 'SME_OWNER', 'SME_STAFF'
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 3A: The Core Tracker (Products)
CREATE TABLE Products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES Businesses(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    base_unit_name VARCHAR(50) NOT NULL, -- e.g., 'sachet', 'meter'
    total_base_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 3B: The Multipliers (Product Packaging)
CREATE TABLE Product_Packaging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES Products(id) ON DELETE CASCADE,
    packaging_name VARCHAR(50) NOT NULL, -- e.g., 'carton', 'roll'
    multiplier INTEGER NOT NULL, -- e.g., 120, 10
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: Money Coming In (Sales Ledger)
CREATE TABLE Sales_Ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES Businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES Products(id) ON DELETE CASCADE,
    logged_by_user_id UUID REFERENCES Users(id) ON DELETE SET NULL,
    quantity_sold_base INTEGER NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    customer_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: Money Going Out (Expenses Ledger)
CREATE TABLE Expenses_Ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES Businesses(id) ON DELETE CASCADE,
    logged_by_user_id UUID REFERENCES Users(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: The AI Memory (Chat Logs)
CREATE TABLE Chat_Logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES Businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('USER', 'AGENT')),
    message_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);




ALTER TABLE Users ADD COLUMN password_hash VARCHAR(255);

ALTER TABLE Products 
ADD COLUMN base_cost_price DECIMAL(12,2) DEFAULT 0,
ADD COLUMN base_selling_price DECIMAL(12,2) DEFAULT 0;

ALTER TABLE Businesses ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';

-- 1. Add the product_type column to handle Physical, Dropship, and Services
ALTER TABLE Products 
ADD COLUMN product_type VARCHAR(20) DEFAULT 'PHYSICAL' CHECK (product_type IN ('PHYSICAL', 'DROPSHIP', 'SERVICE'));

-- 2. Add the needs_web_setup column to flag products created via WhatsApp
ALTER TABLE Products 
ADD COLUMN needs_web_setup BOOLEAN DEFAULT FALSE;

