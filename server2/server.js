const http = require('http');
const { URL } = require('url');
const DatabaseManager = require('./modules/DatabaseManager');
const Messages = require('./lang/en/user');
require('dotenv').config();

class SqlApiServer {
    constructor(port, dbConfig) {
        this.port = port;
        this.db = new DatabaseManager(dbConfig);
        this.baseRoute = '/lab5/api/v1/sql';

        this.server = http.createServer((req, res) => this.handleRequest(req, res));
    }

    setCorsHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    sendJson(res, statusCode, payload) {
        this.setCorsHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
    }

    extractSqlFromPath(pathname) {
        const prefix = this.baseRoute + '/';
        if (!pathname.startsWith(prefix)) return null;

        const rawEncodedSql = pathname.slice(prefix.length);
        let decodedSql;
        try {
            decodedSql = decodeURIComponent(rawEncodedSql).trim();
        } catch {
            decodedSql = rawEncodedSql.trim();
        }

        if (
            (decodedSql.startsWith('"') && decodedSql.endsWith('"')) ||
            (decodedSql.startsWith("'") && decodedSql.endsWith("'"))
        ) {
            decodedSql = decodedSql.slice(1, -1).trim();
        }

        return decodedSql;
    }

    async handleGet(req, res, parsedUrl) {
        let sqlQuery = this.extractSqlFromPath(parsedUrl.pathname);
        if (!sqlQuery) {
            sqlQuery = parsedUrl.searchParams.get('query');
        }

        if (!sqlQuery) {
            return this.sendJson(res, 400, {
                success: false,
                error: Messages.MISSING_SQL_QUERY
            });
        }

        try {
            const rows = await this.db.executeReadQuery(sqlQuery);
            this.sendJson(res, 200, {
                success: true,
                query: sqlQuery,
                data: rows
            });
        } catch (dbError) {
            this.sendJson(res, 403, {
                success: false,
                error: dbError.message,
                code: dbError.code
            });
        }
    }

    handlePost(req, res, parsedUrl) {
        if (parsedUrl.pathname !== this.baseRoute && parsedUrl.pathname !== `${this.baseRoute}/`) {
            return this.sendJson(res, 404, {
                success: false,
                error: Messages.INVALID_ENDPOINT
            });
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                let customQuery = null;

                if (body.trim()) {
                    try {
                        const parsedBody = JSON.parse(body);
                        if (parsedBody.query) {
                            customQuery = parsedBody.query;
                        }
                    } catch {
                        customQuery = body.trim();
                    }
                }

                const result = await this.db.insertPatients(customQuery);
                this.sendJson(res, 200, {
                    success: true,
                    message: Messages.TABLE_READY_AND_INSERTED,
                    result: result
                });
            } catch (dbError) {
                this.sendJson(res, 403, {
                    success: false,
                    error: dbError.message,
                    code: dbError.code
                });
            }
        });
    }

    handleRequest(req, res) {
        if (req.method === 'OPTIONS') {
            this.setCorsHeaders(res);
            res.writeHead(204);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

        if (!parsedUrl.pathname.startsWith(this.baseRoute)) {
            return this.sendJson(res, 404, {
                success: false,
                error: Messages.INVALID_ENDPOINT
            });
        }

        if (req.method === 'GET') {
            this.handleGet(req, res, parsedUrl);
        } else if (req.method === 'POST') {
            this.handlePost(req, res, parsedUrl);
        } else {
            this.sendJson(res, 405, {
                success: false,
                error: Messages.METHOD_NOT_ALLOWED
            });
        }
    }

    start() {
        this.server.listen(this.port, async () => {
            console.log(`Server 2 HTTP listening on http://localhost:${this.port}`);
            try {
                const status = await this.db.testConnections();
                console.log("Connected to Aiven PostgreSQL successfully:", status);
            } catch (err) {
                console.error("Failed to connect to Aiven PostgreSQL:", err.message);
            }
        });
    }
}

const PORT = process.env.PORT || 8080;
let aivenConnection;

if (process.env.AIVEN_URI) {
    try {
        aivenConnection = new URL(process.env.AIVEN_URI);
    } catch (error) {
        console.error(`CRITICAL: Invalid AIVEN_URI: ${error.message}`);
        process.exit(1);
    }
}

const dbConfig = {
    host: aivenConnection?.hostname || process.env.DB_HOST,
    port: Number(aivenConnection?.port || process.env.DB_PORT),
    database: aivenConnection?.pathname.slice(1) || process.env.DB_NAME,
    readerUser: process.env.DB_READER_USER,
    readerPassword: process.env.DB_READER_PASSWORD,
    writerUser: process.env.DB_WRITER_USER,
    writerPassword: process.env.DB_WRITER_PASSWORD
};

if (
    !dbConfig.host ||
    !dbConfig.port ||
    !dbConfig.database ||
    !dbConfig.readerUser ||
    !dbConfig.readerPassword ||
    !dbConfig.writerUser ||
    !dbConfig.writerPassword
) {
    console.error("CRITICAL: Missing database environment variables. Check your .env file or host settings.");
    process.exit(1);
}
console.log(`Attempting to connect to Aiven at: ${dbConfig.host}:${dbConfig.port} (DB: ${dbConfig.database})`);
const app = new SqlApiServer(PORT, dbConfig);
console.log("Server 2 initialized. Ready to accept requests.");
app.start();