"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCollectionOperation = void 0;
const constants_1 = require("../cmap/wire_protocol/constants");
const collection_1 = require("../collection");
const error_1 = require("../error");
const command_1 = require("./command");
const indexes_1 = require("./indexes");
const operation_1 = require("./operation");
const ILLEGAL_COMMAND_FIELDS = new Set([
    'w',
    'wtimeout',
    'j',
    'fsync',
    'autoIndexId',
    'pkFactory',
    'raw',
    'readPreference',
    'session',
    'readConcern',
    'writeConcern',
    'raw',
    'fieldsAsRaw',
    'promoteLongs',
    'promoteValues',
    'promoteBuffers',
    'bsonRegExp',
    'serializeFunctions',
    'ignoreUndefined',
    'enableUtf8Validation'
]);
/* @internal */
const INVALID_QE_VERSION = 'Driver support of Queryable Encryption is incompatible with server. Upgrade server to use Queryable Encryption.';
/** @internal */
class CreateCollectionOperation extends command_1.CommandOperation {
    constructor(db, name, options = {}) {
        super(db, options);
        this.options = options;
        this.db = db;
        this.name = name;
    }
    execute(server, session, callback) {
        (async () => {
            var _a, _b, _c, _d, _e;
            const db = this.db;
            const name = this.name;
            const options = this.options;
            const encryptedFields = (_a = options.encryptedFields) !== null && _a !== void 0 ? _a : (_c = (_b = db.s.client.options.autoEncryption) === null || _b === void 0 ? void 0 : _b.encryptedFieldsMap) === null || _c === void 0 ? void 0 : _c[`${db.databaseName}.${name}`];
            if (encryptedFields) {
                // Creating a QE collection required min server of 7.0.0
                if (server.description.maxWireVersion < constants_1.MIN_SUPPORTED_QE_WIRE_VERSION) {
                    throw new error_1.MongoCompatibilityError(`${INVALID_QE_VERSION} The minimum server version required is ${constants_1.MIN_SUPPORTED_QE_SERVER_VERSION}`);
                }
                // Create auxilliary collections for queryable encryption support.
                const escCollection = (_d = encryptedFields.escCollection) !== null && _d !== void 0 ? _d : `enxcol_.${name}.esc`;
                const ecocCollection = (_e = encryptedFields.ecocCollection) !== null && _e !== void 0 ? _e : `enxcol_.${name}.ecoc`;
                for (const collectionName of [escCollection, ecocCollection]) {
                    const createOp = new CreateCollectionOperation(db, collectionName, {
                        clusteredIndex: {
                            key: { _id: 1 },
                            unique: true
                        }
                    });
                    await createOp.executeWithoutEncryptedFieldsCheck(server, session);
                }
                if (!options.encryptedFields) {
                    this.options = { ...this.options, encryptedFields };
                }
            }
            const coll = await this.executeWithoutEncryptedFieldsCheck(server, session);
            if (encryptedFields) {
                // Create the required index for queryable encryption support.
                const createIndexOp = new indexes_1.CreateIndexOperation(db, name, { __safeContent__: 1 }, {});
                await new Promise((resolve, reject) => {
                    createIndexOp.execute(server, session, err => (err ? reject(err) : resolve()));
                });
            }
            return coll;
        })().then(coll => callback(undefined, coll), err => callback(err));
    }
    executeWithoutEncryptedFieldsCheck(server, session) {
        return new Promise((resolve, reject) => {
            const db = this.db;
            const name = this.name;
            const options = this.options;
            const done = err => {
                if (err) {
                    return reject(err);
                }
                resolve(new collection_1.Collection(db, name, options));
            };
            const cmd = { create: name };
            for (const n in options) {
                if (options[n] != null &&
                    typeof options[n] !== 'function' &&
                    !ILLEGAL_COMMAND_FIELDS.has(n)) {
                    cmd[n] = options[n];
                }
            }
            // otherwise just execute the command
            super.executeCommand(server, session, cmd, done);
        });
    }
}
exports.CreateCollectionOperation = CreateCollectionOperation;
(0, operation_1.defineAspects)(CreateCollectionOperation, [operation_1.Aspect.WRITE_OPERATION]);
//# sourceMappingURL=create_collection.js.map