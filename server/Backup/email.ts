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
