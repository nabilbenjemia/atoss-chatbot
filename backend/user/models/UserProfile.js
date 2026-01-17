const mongoose = require('mongoose');

/**
 * UserProfile Schema
 * Stores additional user profile information
 * Linked to UserCredentials via userId
 */
const userProfileSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true,
		unique: true,
		index: true
	},
	username: {
		type: String,
		trim: true,
		maxlength: 50
	},
	profilePicture: {
		type: String,
		default: null
		// Stores base64 encoded image data (data:image/png;base64,...)
	},
	preferences: {
		theme: {
			type: String,
			enum: ['light', 'dark', 'auto'],
			default: 'auto'
		},
		language: {
			type: String,
			default: 'en'
		},
		notifications: {
			email: {
				type: Boolean,
				default: true
			},
			chat: {
				type: Boolean,
				default: true
			}
		}
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
userProfileSchema.pre('save', function(next) {
	this.updatedAt = Date.now();
	next();
});

// Index for faster lookups
userProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('UserProfile', userProfileSchema);
