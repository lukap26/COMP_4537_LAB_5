class Messages {
    static TABLE_READY_AND_INSERTED = "Table verified (InnoDB) and patient rows inserted successfully.";
    static INVALID_ENDPOINT = "404 Not Found: Invalid API endpoint.";
    static MISSING_SQL_QUERY = "400 Bad Request: No SQL query provided.";
    static METHOD_NOT_ALLOWED = "405 Method Not Allowed.";
}

module.exports = Messages;