'use strict';

var test = require('tape');
var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var beautifulValidation = require('../');

mongoose.plugin(beautifulValidation);

/**
 * Assert that the given object is a correct validation error.
 *
 * @param {Object} t Tape assertion object
 * @param {Object} err Object to test.
 * @param {Object} dups Map from fields that are duplicated to their value.
 * @param {string} [message=default] Ensure the given message is
 * thrown with the duplicate error's sub-errors
 */
function assertUniqueError(t, err, dups, message) {
    t.equal(err.name, 'ValidationError',
        'the thrown error should be of type ValidationError');

    var missing = Object.keys(dups).filter(function (key) {
        var suberr = err.errors[key];

        if (!err.errors[key]) {
            return true;
        }


        t.equal(suberr.name, 'ValidatorError',
            'each sub-error should be of name ValidatorError');
        t.equal(suberr.kind, 'unique',
            'each sub-error\'s kind should be "unique"');

        if (message !== undefined) {
            t.equal(suberr.message, message,
                'each sub-error should carry over the custom message');
        }

        // with buffer values, only compare the inner "buffer" property
        t.equal(
            suberr.properties.value.toString(), dups[key].toString(),
            'the sub-error should contain the duplicated value'
        );

        t.equal(
            suberr.properties.path, key,
            'the sub-error should contain the duplicated value\'s path'
        );

        t.equal(
            suberr.properties.type, 'unique',
            'the sub-error\'s type should be "unique"'
        );

        return false;
    });

    t.equal(
        missing.length, 0,
        'should report a sub-error per duplicated field'
    );

    t.equal(
        Object.keys(err.errors).length, Object.keys(dups).length,
        'should only report a sub-error per duplicated field'
    );
}

test('should report duplicates', function (t) {
    var DuplicateSchema = new Schema({
        name: {
            type: String,
            unique: true
        },
        age: {
            type: Number
        },
        address: {
            type: String,
            unique: true
        }
    });

    var Duplicate = mongoose.model('Duplicate', DuplicateSchema);

    Duplicate.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new Duplicate({
            name: 'John Doe',
            age: 13,
            address: '123 Fake St.'
        }).save().then(function () {
            return new Duplicate({
                name: 'Jane Doe',
                age: 13,
                address: '123 Fake St.'
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {'address': '123 Fake St.'});
            t.end();
        });
    });
});

test('should report duplicates with Model.create()', function (t) {
    var CreateSchema = new Schema({
        name: {
            type: String,
            unique: true
        },
        age: {
            type: Number
        },
        address: {
            type: String,
            unique: true
        }
    });

    var Create = mongoose.model('Create', CreateSchema);

    Create.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        Create.create({
            name: 'John Doe',
            age: 13,
            address: '123 Fake St.'
        }).then(function () {
            return Create.create({
                name: 'Jane Doe',
                age: 13,
                address: '123 Fake St.'
            });
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {'address': '123 Fake St.'});
            t.end();
        });
    });
});

test('should report duplicates with Model.findOneAndUpd()', function (t) {
    var FoauSchema = new Schema({
        address: {
            type: String,
            unique: true
        }
    });

    var Foau = mongoose.model('Foau', FoauSchema);

    Foau.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        // Create two non-conflicting instances and save them
        global.Promise.all([
            new Foau({
                address: '123 Fake St.'
            }).save(),
            new Foau({
                address: '321 Fake St.'
            }).save()
        ]).then(function () {
            // Update one of the instances to conflict with the first one
            Foau.findOneAndUpdate({
                address: '321 Fake St.'
            }, {
                address: '123 Fake St.'
            }).exec().then(function () {
                t.fail('should not update duplicate successfully');
                t.end();
            }, function (err) {
                assertUniqueError(t, err, {'address': '123 Fake St.'});
                t.end();
            });
        }).catch(function (err) {
            t.error(err, 'should save original instance successfully');
            t.end();
        });
    });
});

test('should report duplicates with Model.update()', function (t) {
    var UpdateSchema = new Schema({
        address: {
            type: String,
            unique: true
        }
    });

    var Update = mongoose.model('Update', UpdateSchema);

    Update.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        // Create two non-conflicting instances and save them
        var upd1 = new Update({
            address: '123 Fake St.'
        });

        var upd2 = new Update({
            address: '321 Fake St.'
        });

        global.Promise.all([
            upd1.save(),
            upd2.save()
        ]).then(function () {
            // Update one of the instances to conflict with the first one
            return upd2.update({
                $set: {address: '123 Fake St.'}
            }).exec().then(function () {
                t.fail('should not update duplicate successfully');
                t.end();
            }, function (err) {
                assertUniqueError(t, err, {address: '123 Fake St.'});
                t.end();
            });
        }, function (err) {
            t.error(err, 'should save original instances successfully');
            t.end();
        });
    });
});

test('should report duplicates on fields containing spaces', function (t) {
    var SpacesSchema = new Schema({
        'display name': {
            type: String,
            unique: true
        }
    });

    var Spaces = mongoose.model('Spaces', SpacesSchema);

    Spaces.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new Spaces({
            'display name': 'Testing display names'
        }).save().then(function () {
            return new Spaces({
                'display name': 'Testing display names'
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err,
                {'display name': 'Testing display names'});
            t.end();
        });
    });
});

test('should report duplicates on compound indexes', function (t) {
    var CompoundSchema = new Schema({
        name: String,
        age: Number
    });

    CompoundSchema.index({
        name: 1,
        age: 1
    }, {
        unique: true
    });

    var Compound = mongoose.model('Compound', CompoundSchema);

    Compound.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new Compound({
            name: 'John Doe',
            age: 42
        }).save().then(function () {
            return new Compound({
                name: 'John Doe',
                age: 42
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {
                name: 'John Doe',
                age: 42
            });

            t.end();
        });
    });
});

test('should use custom validation messages', function (t) {
    var MessageSchema = new Schema({
        address: {
            type: String,
            unique: 'this is our custom message!'
        }
    });

    var Message = mongoose.model('Message', MessageSchema);

    Message.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new Message({
            address: '123 Fake St.'
        }).save().then(function () {
            return new Message({
                address: '123 Fake St.'
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {
                address: '123 Fake St.'
            }, 'this is our custom message!');

            t.end();
        });
    });
});

test('should use custom validation messages w/ compound', function (t) {
    var CompoundMessageSchema = new Schema({
        name: String,
        age: Number
    });

    CompoundMessageSchema.index({
        name: 1,
        age: 1
    }, {
        unique: 'yet another custom message'
    });

    var CompoundMessage = mongoose.model(
        'CompoundMessage',
        CompoundMessageSchema
    );

    CompoundMessage.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new CompoundMessage({
            name: 'John Doe',
            age: 42
        }).save().then(function () {
            return new CompoundMessage({
                name: 'John Doe',
                age: 42
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {
                name: 'John Doe',
                age: 42
            }, 'yet another custom message');

            t.end();
        });
    });
});

test('should report duplicates on any mongoose type', function (t) {
    var AnyTypeSchema = new Schema({
        name: String,
        group: Schema.Types.ObjectId,
        age: Number,
        date: Date,
        blob: Buffer,
        isVerified: Boolean,
        list: []
    });

    AnyTypeSchema.index({
        name: 1,
        group: 1,
        age: 1,
        date: 1,
        blob: 1,
        isVerified: 1,
        list: 1
    }, {
        unique: true
    });

    var groupId = new mongoose.Types.ObjectId;
    var date = new Date();
    var AnyType = mongoose.model('AnyType', AnyTypeSchema);

    AnyType.on('index', function (indexErr) {
        t.error(indexErr, 'indexes should be built correctly');

        new AnyType({
            name: 'test',
            group: groupId,
            age: 42,
            date: date,
            blob: new Buffer('abc'),
            isVerified: false,
            list: [1, 2, 3]
        }).save().then(function () {
            return new AnyType({
                name: 'test',
                group: groupId,
                age: 42,
                date: date,
                blob: new Buffer('abc'),
                isVerified: false,
                list: [1, 2, 3]
            }).save();
        }, function (err) {
            t.error(err, 'should save the first document successfully');
            t.end();
        }).then(function () {
            t.fail('should not save the duplicate document successfully');
            t.end();
        }, function (err) {
            assertUniqueError(t, err, {
                name: 'test',
                group: groupId,
                age: 42,
                date: date,
                blob: new Buffer('abc'),
                isVerified: false,
                list: [1, 2, 3]
            });

            t.end();
        });
    });
});
