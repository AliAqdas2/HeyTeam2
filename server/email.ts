import "dotenv/config";
import { Resend } from 'resend';

// HTML escape utility to prevent injection attacks
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string) {
  try {
    const { client, fromEmail } = getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to,
      subject: 'Reset Your HeyTeam Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .code { background: #e5e7eb; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Reset Your Password</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p>We received a request to reset your HeyTeam password. Click the button below to set a new password:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <div class="code">${resetUrl}</div>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this password reset, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendTeamInvitationEmail(
  to: string,
  firstName: string,
  temporaryPassword: string,
  organizationName: string,
  invitedByName: string,
  loginUrl: string
) {
  try {
    const { client, fromEmail } = getResendClient();
    
    const escapedFirstName = escapeHtml(firstName);
    const escapedOrgName = escapeHtml(organizationName);
    const escapedInvitedBy = escapeHtml(invitedByName);
    
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `You've been invited to join ${escapedOrgName} on HeyTeam`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .credentials { background: white; border: 2px solid #2563eb; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .credential-row { margin: 10px 0; }
              .credential-label { font-weight: 600; color: #6b7280; }
              .credential-value { font-family: monospace; background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Welcome to HeyTeam!</h1>
              </div>
              <div class="content">
                <p>Hi ${escapedFirstName},</p>
                <p><strong>${escapedInvitedBy}</strong> has invited you to join <strong>${escapedOrgName}</strong> on HeyTeam.</p>
                <p>HeyTeam is a workforce coordination platform that helps teams manage jobs, schedules, and communication.</p>
                
                <div class="credentials">
                  <h3 style="margin-top: 0;">Your Login Credentials</h3>
                  <div class="credential-row">
                    <div class="credential-label">Email:</div>
                    <div class="credential-value">${to}</div>
                  </div>
                  <div class="credential-row">
                    <div class="credential-label">Temporary Password:</div>
                    <div class="credential-value">${temporaryPassword}</div>
                  </div>
                </div>
                
                <div class="warning">
                  <strong>⚠️ Important:</strong> Please change your password after your first login for security.
                </div>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">Log In to HeyTeam</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  If you have any questions, please contact your team administrator.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Team invitation email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send team invitation email:', error);
    throw error;
  }
}

export async function sendTeamMessageNotification(
  to: string,
  fromUserName: string,
  messagePreview: string,
  loginUrl: string
) {
  try {
    const { client, fromEmail } = getResendClient();
    
    // Escape HTML to prevent injection attacks
    const escapedFromUserName = escapeHtml(fromUserName);
    const escapedMessagePreview = escapeHtml(messagePreview);
    
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `New message from ${escapedFromUserName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .message-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 6px; white-space: pre-wrap; word-wrap: break-word; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New Team Message</h1>
              </div>
              <div class="content">
                <p>Hi,</p>
                <p><strong>${escapedFromUserName}</strong> sent you a message:</p>
                <div class="message-box">
                  <p style="margin: 0;">${escapedMessagePreview}</p>
                </div>
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">View Message</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Log in to HeyTeam to read the full message and reply.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Team message notification email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send team message notification email:', error);
    throw error;
  }
}

interface FeedbackNotificationContext {
  message: string;
  user: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  };
  organizationName: string | null;
}

export async function sendFeedbackNotificationEmail(
  to: string,
  context: FeedbackNotificationContext
) {
  try {
    const { client, fromEmail } = getResendClient();

    const displayName = [context.user.firstName, context.user.lastName]
      .filter(Boolean)
      .join(" ")
      || context.user.username
      || context.user.email;

    const escapedDisplayName = escapeHtml(displayName);
    const escapedEmail = escapeHtml(context.user.email);
    const escapedOrganization = context.organizationName ? escapeHtml(context.organizationName) : null;
    const escapedMessage = escapeHtml(context.message).replace(/\n/g, "<br />");

    await client.emails.send({
      from: fromEmail,
      to,
      subject: `New HeyTeam Feedback from ${escapedDisplayName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; background: #f9fafb; padding: 0; margin: 0; }
              .container { max-width: 640px; margin: 0 auto; padding: 32px 24px; }
              .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
              .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
              .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
              .meta-item { padding: 12px 16px; background: #f3f4f6; border-radius: 8px; }
              .meta-label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
              .message-box { background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; }
              .message-box p { margin: 0; white-space: normal; }
              .footer { margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="header">
                  <h2 style="margin: 0; font-size: 22px; color: #111827;">New Feedback Received</h2>
                </div>
                <div class="meta">
                  <div class="meta-item">
                    <span class="meta-label">Submitted By</span>
                    <span>${escapedDisplayName}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Email Address</span>
                    <span>${escapedEmail}</span>
                  </div>
                  ${escapedOrganization ? `
                    <div class="meta-item">
                      <span class="meta-label">Organization</span>
                      <span>${escapedOrganization}</span>
                    </div>
                  ` : ""}
                </div>
                <div class="message-box">
                  <p>${escapedMessage}</p>
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} HeyTeam. Feedback notification.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Feedback notification email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send feedback notification email:', error);
    throw error;
  }
}

export async function sendCancellationNotification(userInfo: any, reason: string) {
  try {
    const { client, fromEmail } = getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: 'Nadeem.Mohammed@deffinity.com',
      subject: `HeyTeam Subscription Cancellation - ${userInfo.username}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .reason-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .label { font-weight: bold; color: #374151; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🚨 Subscription Cancellation Alert</h1>
              </div>
              <div class="content">
                <p>A HeyTeam subscription has been canceled. Here are the details:</p>
                
                <div class="info-box">
                  <p><span class="label">User:</span> ${escapeHtml(userInfo.username)} (${escapeHtml(userInfo.firstName || '')} ${escapeHtml(userInfo.lastName || '')})</p>
                  <p><span class="label">Email:</span> ${escapeHtml(userInfo.email)}</p>
                  <p><span class="label">User ID:</span> ${escapeHtml(userInfo.id)}</p>
                  <p><span class="label">Cancellation Date:</span> ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="reason-box">
                  <p><span class="label">Cancellation Reason:</span></p>
                  <p>${escapeHtml(reason)}</p>
                </div>
                
                <p>This cancellation has been automatically logged as feedback in the system for review.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    console.log(`Cancellation notification sent to Nadeem.Mohammed@deffinity.com`);
  } catch (error) {
    console.error('Failed to send cancellation notification:', error);
    throw error;
  }
}
