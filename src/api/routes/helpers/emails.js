const nodemailer = require("nodemailer");
const db = require("../../../config/db");

// ---------------- MAIL TRANSPORTER ----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});


function getOtherAdminEmails(borrowerEmail) {
  if (!process.env.ADMIN_EMAILS) return [];

  return process.env.ADMIN_EMAILS
    .split(",")
    .map(e => e.trim())
    .filter(email => email && email !== borrowerEmail);
}






// ================= SINGLE ITEM APPROVAL EMAILS =================
async function sendSingleApprovalEmails({ request, returnDate }) {
  // 1️⃣ Fetch borrower
  const [[borrower]] = await db.promise().query(
    "SELECT username, email, phone_number, access_level FROM users WHERE user_id = ?",
    [request.user_id]
  );

  const isAdminBorrower = borrower.access_level === "admin";

  // 2️⃣ Fetch item
  const [[item]] = await db.promise().query(
    "SELECT name, description, available FROM items WHERE item_id = ?",
    [request.item_id]
  );
  

  // 3️⃣ ADMIN EMAIL (exclude borrowing admin)
  const otherAdmins = getOtherAdminEmails(borrower.email);

  if (!isAdminBorrower || otherAdmins.length) {
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: otherAdmins.join(","),
      subject: "📦 Item Borrowed",
      html: `
        <h3>Item Borrowed</h3>
        <p><strong>Item:</strong> ${item.name}</p>
        <p><strong>Description:</strong> ${item.description}</p>
        <p><strong>Quantity:</strong> ${request.quantity}</p>
        <p><strong>Return Date:</strong> ${returnDate.toDateString()}</p>
        <p><strong>Remaining:</strong> ${item.available}</p>

        <hr />

        <h4>Borrower Details</h4>
        <p><strong>Name:</strong> ${borrower.username}</p>
        <p><strong>Email:</strong> ${borrower.email}</p>
        <p><strong>Phone:</strong> ${borrower.phone_number || "N/A"}</p>
      `,
    });
  }

  // 4️⃣ BORROWER EMAIL
  if (isAdminBorrower) {
    // ADMIN BORROWER → full info, friendly text
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: borrower.email,
      subject: "📦 Borrow Successful",
      html: `
        <h3>Borrow Successful</h3>

        <p>You have successfully borrowed the following item:</p>

        <ul>
          <strong>${item.name}</strong>
          <li>Description: ${item.description}</li>
          <li>Quantity: ${request.quantity}</li>
          <li>Remaining: ${item.available}</li>
          <li>Return Date: ${returnDate.toDateString()}</li>
        </ul>

        <p>— JKUSDA Inventory Team</p>
      `,
    });
  } else {
    // NORMAL USER → NO remaining
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: borrower.email,
      subject: "📌 Borrow Approved",
      html: `
      <h3>Borrow Approved</h3>
      <p>You have successfully borrowed the following item:</p>
      <ul>
        <strong>${item.name}</strong>
        <li>Description: ${item.description}</li>
        <li>Quantity: ${request.quantity}</li>
        <li>Return Date: ${returnDate.toDateString()}</li>
      </ul>

      <p>— JKUSDA Inventory Team</p>
      `,
    });
  }
}


// ================= BATCH ITEM APPROVAL EMAIL =================
async function sendBatchApprovalEmails({ requests, returnDate }) {
  if (!requests || !requests.length) return;

  const userId = requests[0].user_id;

  // 1️⃣ Fetch borrower
  const [[borrower]] = await db.promise().query(
    "SELECT username, email, phone_number, access_level FROM users WHERE user_id = ?",
    [userId]
  );

  const isAdminBorrower = borrower.access_level === "admin";

  // 2️⃣ Fetch item details
  const itemIds = requests.map(r => r.item_id);

  const [items] = await db.promise().query(
    `SELECT item_id, name, available
     FROM items
     WHERE item_id IN (${itemIds.map(() => "?").join(",")})`,
    itemIds
  );



  // ADMIN TABLE (always shows remaining)
const adminRows = requests.map(req => {
  const item = items.find(i => i.item_id === req.item_id);
  return `
    <tr>
      <td>${item?.name || "Unknown"}</td>
      <td>${req.quantity}</td>
      <td>${req.period} days</td>
      <td>${returnDate.toDateString()}</td>
      <td>${item?.available ?? "N/A"}</td>
    </tr>
  `;
}).join("");

const adminTable = `
  <table border="1" cellpadding="8" cellspacing="0" width="100%">
    <thead>
      <tr style="background:#f4f4f4;">
        <th>Item</th>
        <th>Quantity</th>
        <th>Period</th>
        <th>Return Date</th>
        <th>Remaining</th>
      </tr>
    </thead>
    <tbody>
      ${adminRows}
    </tbody>
  </table>
`;





  // 3️⃣ Build rows (remaining ONLY for admins)
  const rows = requests.map(req => {
    const item = items.find(i => i.item_id === req.item_id);
    return `
      <tr>
        <td>${item?.name || "Unknown"}</td>
        <td>${req.quantity}</td>
        <td>${req.period} days</td>
        <td>${returnDate.toDateString()}</td>
        ${isAdminBorrower ? `<td>${item?.available ?? "N/A"}</td>` : ``}
      </tr>
    `;
  }).join("");

  // 4️⃣ Table (conditional column)
  const itemsTable = `
    <table border="1" cellpadding="8" cellspacing="0" width="100%">
      <thead>
        <tr style="background:#f4f4f4;">
          <th>Item</th>
          <th>Quantity</th>
          <th>Period</th>
          <th>Return Date</th>
          ${isAdminBorrower ? `<th>Remaining</th>` : ``}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  // 5️⃣ ADMIN EMAIL (exclude borrowing admin)
  const otherAdmins = getOtherAdminEmails(borrower.email);

  if (!isAdminBorrower || otherAdmins.length) {
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: otherAdmins.join(","),
      subject: "📦 Batch Items Borrowed",
      html: `
        <h3>Batch Borrow Approved</h3>

        ${adminTable}

        <hr />

        <h4>Borrower Details</h4>
        <p><strong>Name:</strong> ${borrower.username}</p>
        <p><strong>Email:</strong> ${borrower.email}</p>
        <p><strong>Phone:</strong> ${borrower.phone_number || "N/A"}</p>
      `,
    });
  }

  // 6️⃣ BORROWER EMAIL (ONE EMAIL ONLY)

  const borrowCount = requests.length;
const pluralText = borrowCount > 1 ? "items" : "item";


  await transporter.sendMail({
    from: '"JKUSDA" <ogwenovincent00@gmail.com>',
    to: borrower.email,
    subject: isAdminBorrower
      ? "📦 Batch Borrow Successful"
      : "📌 Borrow Approved (Batch)",
    html: `
      <h3>
        ${isAdminBorrower
          ? `You have successfully borrowed the following ${pluralText}:`
          : "Your Borrow Request Has Been Approved"}
      </h3>

      ${itemsTable}

      <p style="margin-top:20px;">— JKUSDA Inventory Team</p>
    `,
  });
}






// ================= CHECKOUT CONFIRMATION EMAIL =================
async function sendCheckoutConfirmationEmail({ userEmail, confirmationLink, items }) {
  await transporter.sendMail({
    from: '"JKUSDA" <ogwenovincent00@gmail.com>',
    to: userEmail,
    subject: "Confirm your checkout",
    html: `
      <p>Thank you for checking out!</p>
      <ul>
        ${items
          .map(
            item => `
              <li>
                <strong>${item.name}</strong> — Qty: ${item.quantity}
              </li>`
          )
          .join("")}
      </ul>
      <p>Confirm within 24 hours:</p>
      <a href="${confirmationLink}">Confirm Checkout</a>
    `,
  });
}

// ================= CHECKOUT SUCCESS EMAIL =================
async function sendCheckoutSuccessEmail({
  user,
  confirmation,
  items = [],
}) {
  const isAdminBorrower = user.access_level === "admin";




  // 2️⃣ Fetch item details
  // Fetch item details
const itemIds = items.map(i => i.item_id);

const [items_list] = await db.promise().query(
  `SELECT item_id, name, description, available
   FROM items
   WHERE item_id IN (${itemIds.map(() => "?").join(",")})`,
  itemIds
);

const itemsList = items.map(item => {
  const dbItem = items_list.find(i => Number(i.item_id) === Number(item.item_id));

  return `
    <ul>
      <strong>${item.name}</strong>
      <li>Quantity: <strong>${item.quantity}</strong></li>
      <li>Description: <strong>${dbItem?.description || "N/A"}</strong></li>
      ${items.length > 1 ? `<li>Code: <strong>${item.approval_code}</strong></li>` : ""}
    </ul>
  `;
}).join("");


  const contactSection = isAdminBorrower
    ? ""
    : `
      <p>
        To finalize the process and organize the shipment of your items,
        please contact us using one of the numbers below:
      </p>

      <p>
        📞 <strong>0793590680</strong> Vin Ogweno: Admin<br/>
        📞 <strong>07XXXXXXXX</strong>
      </p>

      <p>
        Please ensure you call at least
        <strong>2 days from today</strong>.
      </p>
    `;

  await transporter.sendMail({
    from: '"JKUSDA" <ogwenovincent00@gmail.com>',
    to: user.email,
    subject: "🎉 Checkout Confirmed Successfully!",
    html: `
      <h2>Checkout Confirmed ✅</h2>

      <p>Your checkout has been successfully confirmed.</p>


      ${contactSection}

      <p>
        ${isAdminBorrower ? "Kindly use your" : "Kindly mention your"}
        <strong>Batch Code: ${confirmation.batch_code}</strong>
        ${isAdminBorrower ? "to finalize checkout." : " when calling."}
      </p>

      

      ${items.length > 1 ? `
  <p>
    <em>
      Since you requested multiple items, if you only need a specific item, please ${isAdminBorrower ? "use"  : "mention"} the item's
      <strong>Code</strong> ${isAdminBorrower ? "." : "when calling."}
    </em>
  </p>
` : ""}

<p>
  <strong>
    ${items.length > 1 ? "Requested Items:" : "Requested Item:"}
  </strong>
</p>

<ul>${itemsList}</ul>


      <p>— JKUSDA Team</p>
    `,
  });
}





async function sendReturnRequestEmailToAdmins(borrow, markingAdminEmail) {
  const admins = process.env.ADMIN_EMAILS
    ?.split(",")
    .map(e => e.trim())
    .filter(Boolean);

  if (!admins || admins.length === 0) return;

  const otherAdmins = admins.filter(email => email !== markingAdminEmail);
  const isAdminSelf = admins.includes(markingAdminEmail);

  // ---------------- FULL EMAIL (OTHER ADMINS) ----------------
  if (otherAdmins.length > 0) {
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: otherAdmins.join(","),
      subject: "📦 Return Request Submitted",
      html: `
        <h3>Return Request</h3>

        <p><strong>Item:</strong> ${borrow.item_name}</p>
        <p><strong>Quantity:</strong> ${borrow.quantity}</p>
        <p><strong>Item Code:</strong> ${borrow.approval_code}</p>

        <hr/>

        <h4>User Details</h4>
        <p><strong>Name:</strong> ${borrow.username}</p>
        <p><strong>Email:</strong> ${borrow.email}</p>
        <p><strong>Phone:</strong> ${borrow.phone_number || "N/A"}</p>

        <p>
          Please use the <strong>item code</strong> above to mark this item as returned in the admin panel.
        </p>
      `,
    });
  }

  // ---------------- REDUCED EMAIL (ADMIN SELF) ----------------
  if (isAdminSelf) {
    await transporter.sendMail({
      from: '"JKUSDA" <ogwenovincent00@gmail.com>',
      to: markingAdminEmail,
      subject: "📦 Return Request Submitted",
      html: `
        <h3>Return Request</h3>

        <p><strong>Item:</strong> ${borrow.item_name}</p>
        <p><strong>Quantity:</strong> ${borrow.quantity}</p>
        <p><strong>Item Code:</strong> ${borrow.approval_code}</p>

        <p>
          ✅ You marked this item as returned.<br>
          Please use the <strong>item code</strong> above to mark this item as returned in the admin panel.
        </p>
      `,
    });
  }
}










module.exports = {
  sendSingleApprovalEmails,
  sendBatchApprovalEmails,
  sendCheckoutConfirmationEmail,
  sendCheckoutSuccessEmail,
  sendReturnRequestEmailToAdmins,
};

