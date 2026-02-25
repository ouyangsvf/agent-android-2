-- 初始化数据库

CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    public_key TEXT,
    platform VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);

-- 配对关系表（可选，用于快速查找已配对设备）
CREATE TABLE IF NOT EXISTS device_pairs (
    device_a VARCHAR(255) REFERENCES devices(id),
    device_b VARCHAR(255) REFERENCES devices(id),
    paired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_a, device_b)
);
