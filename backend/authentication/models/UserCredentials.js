const mongoose = require('mongoose');
const Role = require('./Role');
const Department = require('./Department');

/**
 * UserCredentials Schema
 * Represents the UserCredentialsDB for the Authentication microservice
 * Based on the UML diagram User class structure
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
		enum: [Department.DEPARTMENT_1, Department.DEPARTMENT_2, Department.DEPARTMENT_3],
		required: true
	},
	token: {
		type: String,
		default: null
	},
	// Additional fields for session management
	refreshToken: {
		type: String,
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

