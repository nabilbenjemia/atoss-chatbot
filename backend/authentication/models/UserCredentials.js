const mongoose = require('mongoose');
const Role = require('./Role');
const Department = require('./Department');

/**
 * UserCredentials Model - represents user authentication data and session management
 */
const userCredentialsSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
		default: () => new mongoose.Types.ObjectId().toString()
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true
	},
	passwordHash: {
		type: String,
		required: true
	},
	role: {
		type: String,
		enum: [Role.STAFF, Role.ADMIN],
		required: true,
		default: Role.STAFF
	},
	department: {
		type: String,
		required: true,
		trim: true
	},
	token: {
		type: String,
		default: null
	},
	refreshToken: {
		type: String,
		default: null
	},
	emailVerified: {
		type: Boolean,
		default: false
	},
	emailVerificationToken: {
		type: String,
		default: null
	},
	emailVerificationTokenExpires: {
		type: Date,
		default: null
	},
	lastLogin: {
		type: Date,
		default: null
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

// Update the updatedAt field before saving
userCredentialsSchema.pre('save', function(next) {
	this.updatedAt = Date.now();
	next();
});

// Index for faster lookups
userCredentialsSchema.index({ email: 1 });
userCredentialsSchema.index({ id: 1 });

module.exports = mongoose.model('UserCredentials', userCredentialsSchema);

