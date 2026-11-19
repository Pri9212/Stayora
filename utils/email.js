const nodemailer = require("nodemailer");

/**
 * Creates and returns a Nodemailer transporter configured for Gmail SMTP.
 * Returns null if SMTP_USER or SMTP_PASS are missing from environment variables.
 */
function getTransporter() {
    const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : "";
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : "";

    if (!user || !pass) {
        return null;
    }

    const host = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : "smtp.gmail.com";
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
}

/**
 * Returns the actual sender address. Uses configured Gmail account.
 */
function getFromAddress() {
    const sender = process.env.EMAIL_FROM || process.env.SMTP_USER;
    if (sender && sender.trim() !== "") {
        return `"Wanderlust" <${sender.trim()}>`;
    }
    return null;
}

/**
 * Format a Date object into a readable date string.
 */
function formatDate(date) {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Base email wrapper with Wanderlust branding
 */
function wrapEmailTemplate(contentHtml, title = "Wanderlust Notification") {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #f7f7f7;
                margin: 0;
                padding: 20px;
                color: #222222;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border: 1px solid #eaeaea;
            }
            .header {
                background: linear-gradient(135deg, #fe424d 0%, #ff5a5f 100%);
                padding: 28px 30px;
                text-align: center;
                color: #ffffff;
            }
            .header h1 {
                margin: 0;
                font-size: 26px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .header p {
                margin: 6px 0 0 0;
                font-size: 14px;
                opacity: 0.9;
            }
            .content {
                padding: 30px;
            }
            .table-details {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .table-details td {
                padding: 10px 12px;
                border-bottom: 1px solid #eeeeee;
                font-size: 14px;
            }
            .table-details td.label {
                color: #717171;
                font-weight: 600;
                width: 40%;
            }
            .table-details td.value {
                color: #222222;
                font-weight: 500;
            }
            .badge {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .badge-confirmed {
                background-color: #e6f7ed;
                color: #0d8a4e;
            }
            .badge-cancelled {
                background-color: #fde8e8;
                color: #c81e1e;
            }
            .total-box {
                background-color: #f9f9f9;
                border-left: 4px solid #fe424d;
                padding: 16px;
                border-radius: 4px;
                margin-top: 15px;
            }
            .footer {
                background-color: #fafafa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #888888;
                border-top: 1px solid #eeeeee;
            }
            .footer p {
                margin: 4px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧭 Wanderlust</h1>
                <p>Find your next adventure</p>
            </div>
            <div class="content">
                ${contentHtml}
            </div>
            <div class="footer">
                <p><strong>Wanderlust Vacation Rentals</strong></p>
                <p>This is an automated notification. Please do not reply directly to this email.</p>
                <p>&copy; ${new Date().getFullYear()} Wanderlust Inc. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Sends an email using Nodemailer with Gmail SMTP.
 * Performs real sending; logs explicit error if SMTP is not configured.
 */
async function sendMail(to, subject, htmlContent, label = "Notification") {
    if (!to || typeof to !== "string" || to.trim() === "") {
        console.error(`[Email Service Error] No recipient address provided for ${label}.`);
        return { success: false, error: "Recipient email is missing" };
    }

    const recipient = to.trim();
    const transporter = getTransporter();

    if (!transporter) {
        console.error(`[Email Service Error] Failed sending ${label} to ${recipient}:`);
        console.error(`  Reason: SMTP credentials (SMTP_USER / SMTP_PASS) are not configured in .env.`);
        console.error(`  Configure your Gmail address and 16-character App Password in .env to enable real email sending.`);
        return { success: false, error: "SMTP credentials not configured in .env" };
    }

    const fromAddress = getFromAddress() || `"Wanderlust" <${process.env.SMTP_USER}>`;

    try {
        console.log(`[Email Service] Dispatching ${label} to ${recipient}...`);
        const info = await transporter.sendMail({
            from: fromAddress,
            to: recipient,
            subject: subject,
            html: htmlContent,
        });
        console.log(`[Email Service Success] ${label} delivered to ${recipient} (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[Email Service Error] Failed to deliver ${label} to ${recipient}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * 1. Booking Confirmation Email (sent to Guest's registered email)
 */
async function sendBookingConfirmationEmail({ booking, guest, listing }) {
    if (!guest || !guest.email) {
        console.error("[Email Service Error] Guest email is missing, cannot send confirmation email.");
        return { success: false, error: "Guest email is missing" };
    }

    const guestEmail = guest.email.trim();
    const checkInFormatted = formatDate(booking.checkIn);
    const checkOutFormatted = formatDate(booking.checkOut);

    const bodyHtml = `
        <h2 style="color: #222222; margin-top: 0;">Booking Confirmation 🎉</h2>
        <p>Dear <strong>${guest.username || "Guest"}</strong>,</p>
        <p>Thank you for choosing <strong>Wanderlust</strong>! Your reservation has been successfully confirmed. Below are your complete booking details:</p>
        
        <table class="table-details">
            <tr>
                <td class="label">Booking ID</td>
                <td class="value"><strong>${booking.bookingId}</strong></td>
            </tr>
            <tr>
                <td class="label">Booking Status</td>
                <td class="value"><span class="badge badge-confirmed">Confirmed</span></td>
            </tr>
            <tr>
                <td class="label">Property Name</td>
                <td class="value"><strong>${listing.title}</strong></td>
            </tr>
            <tr>
                <td class="label">Location</td>
                <td class="value">${listing.location}, ${listing.country}</td>
            </tr>
            <tr>
                <td class="label">Check-in Date</td>
                <td class="value">${checkInFormatted}</td>
            </tr>
            <tr>
                <td class="label">Check-out Date</td>
                <td class="value">${checkOutFormatted}</td>
            </tr>
            <tr>
                <td class="label">Duration</td>
                <td class="value">${booking.nights} night${booking.nights > 1 ? "s" : ""}</td>
            </tr>
            <tr>
                <td class="label">Guests</td>
                <td class="value">${booking.guests} guest${booking.guests > 1 ? "s" : ""}</td>
            </tr>
            <tr>
                <td class="label">Price per Night</td>
                <td class="value">&#8377;${booking.pricePerNight ? booking.pricePerNight.toLocaleString("en-IN") : listing.price.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
                <td class="label">Cleaning Fee</td>
                <td class="value">&#8377;${booking.cleaningFee ? booking.cleaningFee.toLocaleString("en-IN") : "500"}</td>
            </tr>
        </table>

        <div class="total-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 16px; font-weight: 600; color: #222222;">Total Booking Amount:</span>
                <span style="font-size: 20px; font-weight: 700; color: #fe424d; float: right;">&#8377;${booking.totalPrice.toLocaleString("en-IN")}</span>
            </div>
            <div style="clear: both;"></div>
        </div>

        <p style="margin-top: 25px; line-height: 1.6;">
            We hope you have an incredible trip! If you need to view or manage your reservation, visit the <strong>My Bookings</strong> section on Wanderlust.
        </p>
        <p style="margin-bottom: 0;">Warm regards,<br><strong>The Wanderlust Team</strong></p>
    `;

    const html = wrapEmailTemplate(bodyHtml, `Booking Confirmed: ${listing.title} (${booking.bookingId})`);
    return await sendMail(guestEmail, `Booking Confirmed! - ${listing.title} [${booking.bookingId}]`, html, "Guest Booking Confirmation");
}

/**
 * 2. Property Owner Notification Email (sent to Host's registered email)
 */
async function sendOwnerBookingNotificationEmail({ booking, guest, owner, listing }) {
    if (!owner || !owner.email) {
        console.error("[Email Service Error] Owner email is missing, cannot send host notification.");
        return { success: false, error: "Owner email is missing" };
    }

    const ownerEmail = owner.email.trim();
    const guestEmail = guest && guest.email ? guest.email.trim() : "N/A";
    const checkInFormatted = formatDate(booking.checkIn);
    const checkOutFormatted = formatDate(booking.checkOut);

    const bodyHtml = `
        <h2 style="color: #222222; margin-top: 0;">New Reservation Received! 🏡</h2>
        <p>Hello <strong>${owner.username || "Host"}</strong>,</p>
        <p>Great news! You have received a new booking for your property on <strong>Wanderlust</strong>.</p>
        
        <table class="table-details">
            <tr>
                <td class="label">Property Name</td>
                <td class="value"><strong>${listing.title}</strong></td>
            </tr>
            <tr>
                <td class="label">Booking ID</td>
                <td class="value"><strong>${booking.bookingId}</strong></td>
            </tr>
            <tr>
                <td class="label">Guest Name</td>
                <td class="value"><strong>${guest.username || "Guest"}</strong></td>
            </tr>
            <tr>
                <td class="label">Guest Email</td>
                <td class="value">${guestEmail}</td>
            </tr>
            <tr>
                <td class="label">Check-in Date</td>
                <td class="value">${checkInFormatted}</td>
            </tr>
            <tr>
                <td class="label">Check-out Date</td>
                <td class="value">${checkOutFormatted}</td>
            </tr>
            <tr>
                <td class="label">Number of Nights</td>
                <td class="value">${booking.nights} night${booking.nights > 1 ? "s" : ""}</td>
            </tr>
            <tr>
                <td class="label">Number of Guests</td>
                <td class="value">${booking.guests} guest${booking.guests > 1 ? "s" : ""}</td>
            </tr>
            <tr>
                <td class="label">Total Booking Amount</td>
                <td class="value"><strong>&#8377;${booking.totalPrice.toLocaleString("en-IN")}</strong></td>
            </tr>
            <tr>
                <td class="label">Status</td>
                <td class="value"><span class="badge badge-confirmed">Confirmed</span></td>
            </tr>
        </table>

        <p style="margin-top: 20px;">
            You can view all reservations received for your listings anytime by visiting the <strong>Host Dashboard</strong> on Wanderlust.
        </p>
        <p style="margin-bottom: 0;">Warm regards,<br><strong>The Wanderlust Team</strong></p>
    `;

    const html = wrapEmailTemplate(bodyHtml, `New Booking Received: ${listing.title} (${booking.bookingId})`);
    return await sendMail(ownerEmail, `New Booking Received! - ${listing.title} [${booking.bookingId}]`, html, "Host Booking Notification");
}

/**
 * 3. Booking Cancellation Email (sent to Guest's registered email)
 */
async function sendBookingCancellationEmail({ booking, guest, listing }) {
    if (!guest || !guest.email) {
        console.error("[Email Service Error] Guest email is missing, cannot send cancellation email.");
        return { success: false, error: "Guest email is missing" };
    }

    const guestEmail = guest.email.trim();
    const checkInFormatted = formatDate(booking.checkIn);
    const checkOutFormatted = formatDate(booking.checkOut);

    const bodyHtml = `
        <h2 style="color: #c81e1e; margin-top: 0;">Booking Cancellation Confirmation</h2>
        <p>Dear <strong>${guest.username || "Guest"}</strong>,</p>
        <p>Your booking with <strong>Wanderlust</strong> has been successfully cancelled as per your request.</p>
        
        <table class="table-details">
            <tr>
                <td class="label">Booking ID</td>
                <td class="value"><strong>${booking.bookingId}</strong></td>
            </tr>
            <tr>
                <td class="label">Booking Status</td>
                <td class="value"><span class="badge badge-cancelled">Cancelled</span></td>
            </tr>
            <tr>
                <td class="label">Property Name</td>
                <td class="value"><strong>${listing.title}</strong></td>
            </tr>
            <tr>
                <td class="label">Previously Booked Dates</td>
                <td class="value">${checkInFormatted} to ${checkOutFormatted}</td>
            </tr>
            <tr>
                <td class="label">Booking Amount</td>
                <td class="value">&#8377;${booking.totalPrice.toLocaleString("en-IN")}</td>
            </tr>
        </table>

        <p style="margin-top: 25px; line-height: 1.6;">
            Your reserved dates have now been released. Whenever you're ready to plan your next trip, we'll be here to welcome you back!
        </p>
        <p style="margin-bottom: 0;">Warm regards,<br><strong>The Wanderlust Team</strong></p>
    `;

    const html = wrapEmailTemplate(bodyHtml, `Booking Cancelled: ${listing.title} (${booking.bookingId})`);
    return await sendMail(guestEmail, `Booking Cancelled - ${listing.title} [${booking.bookingId}]`, html, "Guest Cancellation Confirmation");
}

module.exports = {
    sendBookingConfirmationEmail,
    sendBookingCancellationEmail,
    sendOwnerBookingNotificationEmail,
};
