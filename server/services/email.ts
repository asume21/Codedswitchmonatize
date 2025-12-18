import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'CodedSwitch Studio <servicehelp@codedswitch.com>';

export async function sendActivationKeyEmail(
  email: string,
  activationKey: string,
  userName?: string
): Promise<boolean> {
  if (!resend) {
    console.log('Email service not configured - RESEND_API_KEY missing');
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your CodedSwitch Studio Pro Activation Key',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed, #ec4899); padding: 30px; border-radius: 12px; text-align: center;">
            <h1 style="color: white; margin: 0;">CodedSwitch Studio</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Welcome to Pro!</p>
          </div>
          
          <div style="padding: 30px 0;">
            <p style="color: #333; font-size: 16px;">
              ${userName ? `Hi ${userName},` : 'Hi there,'}
            </p>
            <p style="color: #333; font-size: 16px;">
              Thank you for subscribing to CodedSwitch Studio Pro! Here's your activation key:
            </p>
            
            <div style="background: #f3f4f6; border: 2px dashed #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <code style="font-size: 18px; color: #7c3aed; font-weight: bold; letter-spacing: 1px;">
                ${activationKey}
              </code>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              To activate your Pro features:
            </p>
            <ol style="color: #666; font-size: 14px;">
              <li>Log into CodedSwitch Studio</li>
              <li>Go to Settings or click "Activate Pro"</li>
              <li>Enter your activation key above</li>
            </ol>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Keep this key safe - you may need it if you switch devices.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px;">
              CodedSwitch Studio - AI-Powered Music Creation
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send activation key email:', error);
      return false;
    }

    console.log(`Activation key email sent to ${email}, message ID: ${data?.id}`);
    return true;
  } catch (err) {
    console.error('Error sending activation key email:', err);
    return false;
  }
}
