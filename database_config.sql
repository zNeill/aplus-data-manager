CREATE TABLE api_cache (
    id SERIAL PRIMARY KEY,
    object TEXT NOT NULL,                  
    account_code TEXT NOT NULL,            
    event_code TEXT NOT NULL,               
    identifier_code TEXT,                   -- Can be regCode, activityCode, etc.
    query_params JSONB,            
    response JSONB NOT NULL,                
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_api_cache_lookup 
ON api_cache (object, account_code, event_code, identifier_code);


CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);
CREATE INDEX idx_users_username ON users(username);
