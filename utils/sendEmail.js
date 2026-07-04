import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

export default async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: `"Girly 💗" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    return info;
  } catch (error) {
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

export function generateOTPEmailHTML(otp, type) {
  const isRegister = type === 'register';
  const title = isRegister ? 'Verify Your Account' : 'Reset Your Password';
  const description = isRegister
    ? 'Thank you for choosing Girly Store! Please use the following One-Time Password (OTP) to verify your account and complete your registration.'
    : 'We received a request to reset your Girly Store account password. Please use the following One-Time Password (OTP) to complete the reset process.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; background-color: #FFF5F9; font-family: 'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="500" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(232, 0, 111, 0.08); border: 1px solid #FFCCE5;">
              
              <!-- Header Section -->
              <tr>
                <td align="center" style="background-color: #E8006F; padding: 35px 20px;">
                  <h1 style="margin: 0; color: #ffffff; font-family: 'Playfair Display', 'Georgia', serif; font-size: 32px; font-weight: 900; letter-spacing: 1px; line-height: 1.2;">Girly Store 💗</h1>
                  <p style="margin: 6px 0 0 0; color: #FFF5F9; font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">${title}</p>
                </td>
              </tr>

              <!-- Body Section -->
              <tr>
                <td style="padding: 40px 30px; background-color: #ffffff;">
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 24px; font-weight: 500;">
                    Hello,
                  </p>
                  <p style="margin: 0 0 30px 0; color: #555555; font-size: 14px; line-height: 22px;">
                    ${description}
                  </p>
                  
                  <!-- OTP Box -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                      <td align="center">
                        <div style="background-color: #FFF5F9; border: 2px dashed #E8006F; border-radius: 12px; padding: 20px; display: inline-block; min-width: 240px; text-align: center;">
                          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #E8006F; display: block; line-height: 1;">${otp}</span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 10px 0; color: #E8006F; font-size: 14px; font-weight: 700; text-align: center;">
                    This code expires in 10 minutes.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #dc2626; font-size: 13px; font-weight: 600; text-align: center; background-color: #fee2e2; padding: 8px; border-radius: 6px;">
                    ⚠ Do not share this code with anyone.
                  </p>
                  
                  <p style="margin: 0; color: #777777; font-size: 13px; line-height: 20px;">
                    If you did not request this code, please ignore this email or contact support if you have concerns.
                  </p>
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td align="center" style="background-color: #FFF5F9; padding: 25px 20px; border-top: 1px solid #FFCCE5;">
                  <p style="margin: 0; color: #E8006F; font-size: 13px; font-weight: 700;">Girly Store</p>
                  <p style="margin: 4px 0 0 0; color: #777777; font-size: 11px; font-weight: 500; line-height: 1.4;">
                    Women's Clothing Store, Kollengode, Kerala
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generateWelcomeEmailHTML(userName, products) {
  const title = 'Welcome to Girly Store';

  let productsHTML = '';
  if (products && products.length > 0) {
    productsHTML = `
      <div style="margin-top: 30px; border-top: 1px dashed #FFCCE5; padding-top: 25px;">
        <h3 style="margin: 0 0 15px 0; color: #E8006F; font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: center;">Featured Collections</h3>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
    `;

    products.forEach((prod, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        productsHTML += `</tr><tr><td style="padding: 10px 0;"></td></tr><tr>`;
      }
      
      const price = prod.discountPrice || prod.price;
      const originalPrice = prod.discountPrice ? `<span style="text-decoration: line-through; color: #999; font-size: 11px; margin-left: 5px;">₹${prod.price}</span>` : '';
      const imgUrl = prod.images && prod.images[0]?.url ? prod.images[0].url : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=200';

      productsHTML += `
        <td width="48%" align="center" style="vertical-align: top; background-color: #FFF5F9; border-radius: 12px; padding: 15px; border: 1px solid #FFCCE5;">
          <img src="${imgUrl}" alt="${prod.name}" style="width: 100%; max-width: 140px; height: 160px; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 10px; border: 1px solid #FFD9EC;" />
          <h4 style="margin: 0 0 5px 0; color: #333333; font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 700; line-height: 1.3; height: 32px; overflow: hidden; text-align: center;">${prod.name}</h4>
          <p style="margin: 0; color: #E8006F; font-size: 13px; font-weight: 800; text-align: center;">₹${price}${originalPrice}</p>
          <a href="http://localhost:5173/products/${prod._id}" style="display: inline-block; margin-top: 10px; background-color: #E8006F; color: #ffffff; font-family: 'Poppins', sans-serif; font-size: 10px; font-weight: 700; text-decoration: none; padding: 6px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">Shop Now</a>
        </td>
        <td width="4%">&nbsp;</td>
      `;
    });

    if (products.length % 2 !== 0) {
      productsHTML += `<td width="48%">&nbsp;</td>`;
    }

    productsHTML += `
          </tr>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; background-color: #FFF5F9; font-family: 'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="500" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(232, 0, 111, 0.08); border: 1px solid #FFCCE5;">
              
              <!-- Header Section -->
              <tr>
                <td align="center" style="background-color: #E8006F; padding: 35px 20px;">
                  <h1 style="margin: 0; color: #ffffff; font-family: 'Playfair Display', 'Georgia', serif; font-size: 32px; font-weight: 900; letter-spacing: 1px; line-height: 1.2;">Girly Store 💗</h1>
                  <p style="margin: 6px 0 0 0; color: #FFF5F9; font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Welcome To Girly Store</p>
                </td>
              </tr>

              <!-- Body Section -->
              <tr>
                <td style="padding: 35px 25px; background-color: #ffffff;">
                  <p style="margin: 0 0 15px 0; color: #333333; font-size: 16px; line-height: 24px; font-weight: 700; text-align: center;">
                    Hello ${userName}, 💗
                  </p>
                  <p style="margin: 0 0 20px 0; color: #555555; font-size: 14px; line-height: 22px; text-align: center;">
                    Welcome to the Girly family! We are absolutely thrilled to have you shop with us. Discover the latest collections of premium Western Wear, elegant Churidar Sets, and beautiful outfits curated exclusively for you.
                  </p>

                  <!-- Shop Now CTA Button -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                      <td align="center">
                        <a href="http://localhost:5173/shop" style="background-color: #E8006F; color: #ffffff; font-family: 'Poppins', sans-serif; font-size: 13px; font-weight: 800; text-decoration: none; padding: 12px 30px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 15px rgba(232, 0, 111, 0.2); text-transform: uppercase; letter-spacing: 1px;">Start Shopping</a>
                      </td>
                    </tr>
                  </table>

                  <!-- Dynamic Product Suggestions Grid -->
                  ${productsHTML}

                  <p style="margin: 30px 0 0 0; color: #777777; font-size: 13px; line-height: 20px; text-align: center; border-top: 1px solid #FFCCE5; padding-top: 20px;">
                    If you have any questions, feel free to reply directly to this email. We're here to make your fashion journey delightful!
                  </p>
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td align="center" style="background-color: #FFF5F9; padding: 25px 20px; border-top: 1px solid #FFCCE5;">
                  <p style="margin: 0; color: #E8006F; font-size: 13px; font-weight: 700;">Girly Store</p>
                  <p style="margin: 4px 0 0 0; color: #777777; font-size: 11px; font-weight: 500; line-height: 1.4;">
                    Women's Clothing Store, Kollengode, Kerala
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
