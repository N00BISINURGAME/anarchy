const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');


module.exports = {
    async getDBConnection() {
        const db = await sqlite.open({
            filename: 'league.db',
            driver: sqlite3.Database
        });
        return db;
    }
}