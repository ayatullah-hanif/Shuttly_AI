-- Cities table - Main transport hubs
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bus stops table - Locations within cities
CREATE TABLE bus_stops (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(city_id, name)
);

-- Routes table - Connections between stops
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    origin_stop_id INTEGER REFERENCES bus_stops(id),
    destination_stop_id INTEGER REFERENCES bus_stops(id),
    distance_km DECIMAL(6, 2),
    base_price DECIMAL(10, 2) NOT NULL,
    estimated_duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(origin_stop_id, destination_stop_id)
);

-- Buses table - Fleet management
CREATE TABLE buses (
    id SERIAL PRIMARY KEY,
    bus_number VARCHAR(50) NOT NULL UNIQUE,
    plate_number VARCHAR(20) UNIQUE,
    capacity INTEGER DEFAULT 18,
    current_stop_id INTEGER REFERENCES bus_stops(id),
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'available', -- available, in_transit, maintenance
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users table - WhatsApp users (anonymized)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of phone number
    whatsapp_name VARCHAR(200),
    preferred_city_id INTEGER REFERENCES cities(id),
    total_queries INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_interaction TIMESTAMP DEFAULT NOW()
);

-- Conversations table - Track user interactions
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(50), -- text, location, button_reply
    user_message TEXT,
    bot_response TEXT,
    intent VARCHAR(100), -- get_price, check_status, complaint, etc.
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Queries table - Logged price/status queries
CREATE TABLE queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_type VARCHAR(50), -- price_check, bus_status, waiting_time
    origin_stop_id INTEGER REFERENCES bus_stops(id),
    destination_stop_id INTEGER REFERENCES bus_stops(id),
    response_data JSONB, -- Store full response
    created_at TIMESTAMP DEFAULT NOW()
);

-- Complaints table - Customer feedback
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    complaint_text TEXT NOT NULL,
    category VARCHAR(100), -- delay, service, cleanliness, driver_behavior
    sentiment_score DECIMAL(3, 2), -- -1.0 to 1.0
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved
    bus_id INTEGER REFERENCES buses(id),
    route_id INTEGER REFERENCES routes(id),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Waiting time predictions training data
CREATE TABLE waiting_time_logs (
    id SERIAL PRIMARY KEY,
    stop_id INTEGER REFERENCES bus_stops(id),
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    hour_of_day INTEGER, -- 0-23
    actual_waiting_minutes INTEGER,
    passenger_count INTEGER,
    weather_condition VARCHAR(50),
    logged_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data for Nigerian cities
INSERT INTO cities (name, state) VALUES
    ('Lagos', 'Lagos'),
    ('Ikeja', 'Lagos'),
    ('Victoria Island', 'Lagos'),
    ('Lekki', 'Lagos'),
    ('Ibadan', 'Oyo'),
    ('Ilorin', 'Kwara'),
    ('Minna', 'Niger');

-- Sample bus stops for Lagos
INSERT INTO bus_stops (city_id, name, latitude, longitude, address) VALUES
    (1, 'Ojota', 6.5833, 3.3833, 'Ojota Bus Stop, Lagos'),
    (1, 'Berger', 6.6246, 3.3569, 'Berger Junction, Lagos'),
    (1, 'Maryland', 6.5761, 3.3647, 'Maryland Bus Stop, Lagos'),
    (1, 'Ikorodu', 6.6194, 3.5094, 'Ikorodu Garage, Lagos'),
    (1, 'Oshodi', 6.5450, 3.3422, 'Oshodi Interchange, Lagos');

-- Sample bus stops for Ikeja
INSERT INTO bus_stops (city_id, name, latitude, longitude, address) VALUES
    (2, 'Ikeja City Mall', 6.6019, 3.3515, 'Ikeja City Mall, Obafemi Awolowo Way'),
    (2, 'Allen Avenue', 6.5983, 3.3569, 'Allen Avenue Roundabout, Ikeja'),
    (2, 'Computer Village', 6.5478, 3.3581, 'Computer Village, Ikeja');

-- Sample bus stops for Ibadan
INSERT INTO bus_stops (city_id, name, latitude, longitude, address) VALUES
    (5, 'Challenge', 7.4078, 3.9167, 'Challenge Bus Stop, Ibadan'),
    (5, 'Dugbe', 7.3886, 3.8961, 'Dugbe Market, Ibadan'),
    (5, 'Iwo Road', 7.4042, 3.9144, 'Iwo Road Interchange, Ibadan'),
    (5, 'Gate', 7.4467, 3.9019, 'UI Gate, Ibadan');

-- Sample bus stops for Ilorin
INSERT INTO bus_stops (city_id, name, latitude, longitude, address) VALUES
    (6, 'Unity', 8.4890, 4.5424, 'Unity Junction, Ilorin'),
    (6, 'Challenge', 8.4799, 4.5420, 'Challenge, Ilorin'),
    (6, 'Tanke', 8.5069, 4.5761, 'Tanke, Ilorin');

-- Sample bus stops for Minna
INSERT INTO bus_stops (city_id, name, latitude, longitude, address) VALUES
    (7, 'Kpakungu', 9.5994, 6.5444, 'Kpakungu, Minna'),
    (7, 'Tunga', 9.6136, 6.5533, 'Tunga, Minna'),
    (7, 'Chanchaga', 9.5925, 6.5594, 'Chanchaga, Minna');

-- Sample routes with prices (Nigerian Naira)
INSERT INTO routes (origin_stop_id, destination_stop_id, distance_km, base_price, estimated_duration_minutes) VALUES
    (1, 2, 5.2, 300, 15),   -- Ojota to Berger
    (2, 3, 3.8, 250, 12),   -- Berger to Maryland
    (3, 5, 8.5, 400, 25),   -- Maryland to Oshodi
    (1, 5, 12.0, 500, 35),  -- Ojota to Oshodi
    (9, 10, 4.2, 350, 18);  -- Challenge to Dugbe (Ibadan)

-- Sample buses
INSERT INTO buses (bus_number, plate_number, capacity, current_stop_id, status) VALUES
    ('BUS001', 'LAG-123-AB', 18, 1, 'available'),
    ('BUS002', 'LAG-456-CD', 18, 2, 'in_transit'),
    ('BUS003', 'LAG-789-EF', 18, 5, 'available'),
    ('BUS004', 'IBD-012-GH', 18, 9, 'available');

-- Indexes for performance
CREATE INDEX idx_bus_stops_city ON bus_stops(city_id);
CREATE INDEX idx_routes_origin ON routes(origin_stop_id);
CREATE INDEX idx_routes_destination ON routes(destination_stop_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_created ON conversations(created_at);
CREATE INDEX idx_queries_user ON queries(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_users_phone_hash ON users(phone_hash);