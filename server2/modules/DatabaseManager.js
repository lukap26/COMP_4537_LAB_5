const { Pool } = require('pg');

class DatabaseManager {
    constructor(dbConfig) {
        this.readerUser = dbConfig.readerUser;
        const sslConfig = { rejectUnauthorized: false }; // Required for Aiven cloud connections

        
        this.readerPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.readerUser,
            password: dbConfig.readerPassword,
            database: dbConfig.database,
            ssl: sslConfig,
            max: 5,
            connectionTimeoutMillis: 5000
        });

        this.writerPool = new Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.writerUser,
            password: dbConfig.writerPassword,
            database: dbConfig.database,
            ssl: sslConfig,
            max: 5,
            connectionTimeoutMillis: 5000
        });
    }

    async testConnections() {
        const readerRes = await this.readerPool.query('SELECT current_user, current_database();');
        const writerRes = await this.writerPool.query('SELECT current_user, current_database();');
        return {
            reader: readerRes.rows[0],
            writer: writerRes.rows[0]
        };
    }

    async ensurePatientTableExists() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS patient (
                patientid SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                dateOfBirth TIMESTAMP NOT NULL
            );
            GRANT SELECT ON patient TO ${this.readerUser};
        `;
        await this.writerPool.query(createTableSQL);
    }

    async insertPatients(customInsertQuery = null) {
        await this.ensurePatientTableExists();

        const defaultInsertSQL = `
            INSERT INTO patient (name, dateOfBirth) VALUES
            ('Sara Brown', '1901-01-01'),
            ('John Smith', '1941-01-01'),
            ('Jack Ma', '1961-01-30'),
            ('Elon Musk', '1999-01-01');
        `;

        const sqlToExecute = customInsertQuery || defaultInsertSQL;
        const result = await this.writerPool.query(sqlToExecute);
        return {
            rowCount: result.rowCount,
            command: result.command
        };
    }

    async executeReadQuery(sqlQuery) {
        const result = await this.readerPool.query(sqlQuery);
        return result.rows;
    }
}

module.exports = DatabaseManager;