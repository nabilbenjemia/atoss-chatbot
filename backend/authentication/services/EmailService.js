const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * EmailService
 * Handles sending emails for email verification
 */
class EmailService {
	constructor() {
		// Email configuration from environment variables
		this.transporter = null;
		this.fromEmail = process.env.EMAIL_FROM || 'noreply@atoss-gpt.com';
		this.appUrl = process.env.APP_URL || 'http://localhost:5173';
		this.init();
	}

	/**
	 * Initialize nodemailer transporter
	 */
	init() {
		// For development, use Gmail or other SMTP service
		// For production, configure with your email service
		const emailConfig = {
			host: process.env.SMTP_HOST || 'smtp.gmail.com',
			port: parseInt(process.env.SMTP_PORT || '587'),
			secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS, // Use App Password for Gmail
			},
		};

		// Only create transporter if credentials are provided
		if (emailConfig.auth.user && emailConfig.auth.pass) {
			this.transporter = nodemailer.createTransport(emailConfig);
		} else {
			console.warn('⚠️  Email service not configured. Email sending will be disabled.');
			console.warn('   Set SMTP_USER and SMTP_PASS in .env to enable email sending.');
		}
	}

	/**
	 * Generate email verification token
	 * @returns {string} - Random token
	 */
	generateVerificationToken() {
		return crypto.randomBytes(32).toString('hex');
	}

	/**
	 * Send email verification email
	 * @param {string} email - User email
	 * @param {string} token - Verification token
	 * @returns {Promise<Object>}
	 */
	async sendVerificationEmail(email, token) {
		if (!this.transporter) {
			console.log(`📧 [DEV MODE] Verification email would be sent to: ${email}`);
			console.log(`📧 [DEV MODE] Verification link: ${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`);
			return { success: true, devMode: true };
		}

		// URL-encode the token to ensure it's properly handled in the email link
		const verificationUrl = `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;

		const mailOptions = {
			from: `"ATOSS.GPT" <${this.fromEmail}>`,
			to: email,
			subject: 'Verify Your Email Address - ATOSS.GPT',
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Verify Your Email</title>
				</head>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background: linear-gradient(135deg, #0065BD 0%, #003865 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 28px;">ATOSS.GPT</h1>
						<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">TUM Universitäts Klinikum</p>
					</div>
					<div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
						<h2 style="color: #0065BD; margin-top: 0;">Verify Your Email Address</h2>
						<p>Thank you for registering with ATOSS.GPT!</p>
						<p>Please click the button below to verify your email address and activate your account:</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${verificationUrl}" 
							   style="background-color: #0065BD; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
								Verify Email Address
							</a>
						</div>
						<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
						<p style="color: #0065BD; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
						<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
						<p style="color: #999; font-size: 12px; margin: 0;">
							This link will expire in 24 hours. If you didn't create an account, please ignore this email.
						</p>
					</div>
				</body>
				</html>
			`,
			text: `
				Verify Your Email Address - ATOSS.GPT
				
				Thank you for registering with ATOSS.GPT!
				
				Please click the following link to verify your email address:
				${verificationUrl}
				
				This link will expire in 24 hours.
				
				If you didn't create an account, please ignore this email.
			`,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);
			console.log(`✅ Verification email sent to ${email}:`, info.messageId);
			return { success: true, messageId: info.messageId };
		} catch (error) {
			console.error('❌ Error sending verification email:', error);
			throw new Error('Failed to send verification email');
		}
	}

	/**
	 * Send password reset email (for future use)
	 * @param {string} email - User email
	 * @param {string} token - Reset token
	 * @returns {Promise<Object>}
	 */
	async sendPasswordResetEmail(email, token) {
		if (!this.transporter) {
			console.log(`📧 [DEV MODE] Password reset email would be sent to: ${email}`);
			console.log(`📧 [DEV MODE] Reset link: ${this.appUrl}/reset-password?token=${token}`);
			return { success: true, devMode: true };
		}

		const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

		const mailOptions = {
			from: `"ATOSS.GPT" <${this.fromEmail}>`,
			to: email,
			subject: 'Reset Your Password - ATOSS.GPT',
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Reset Your Password</title>
				</head>
				<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background: linear-gradient(135deg, #0065BD 0%, #003865 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 28px;">ATOSS.GPT</h1>
						<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">TUM Universitäts Klinikum</p>
					</div>
					<div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
						<h2 style="color: #0065BD; margin-top: 0;">Reset Your Password</h2>
						<p>You requested to reset your password for your ATOSS.GPT account.</p>
						<p>Click the button below to reset your password:</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${resetUrl}" 
							   style="background-color: #0065BD; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
								Reset Password
							</a>
						</div>
						<p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
						<p style="color: #0065BD; font-size: 12px; word-break: break-all;">${resetUrl}</p>
						<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
						<p style="color: #999; font-size: 12px; margin: 0;">
							This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
						</p>
					</div>
				</body>
				</html>
			`,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);
			console.log(`✅ Password reset email sent to ${email}:`, info.messageId);
			return { success: true, messageId: info.messageId };
		} catch (error) {
			console.error('❌ Error sending password reset email:', error);
			throw new Error('Failed to send password reset email');
		}
	}
}

module.exports = new EmailService();


