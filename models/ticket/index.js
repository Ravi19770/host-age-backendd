const User = require("../User");
const Ticket = require("./ticket");
const TicketMessage = require("./TicketMessage");
const TicketAttachment = require("./TicketAttachment");
const TicketHistory = require("./TicketHistory");
const TicketInternalNote = require("./TicketInternalNote");


// ===============================
// User ↔ Ticket
// ===============================
User.hasMany(Ticket, {
  foreignKey: "userId",
});

Ticket.belongsTo(User, {
  foreignKey: "userId",
});


// ===============================
// Ticket ↔ Messages
// ===============================
Ticket.hasMany(TicketMessage, {
  foreignKey: "ticketId",
});

TicketMessage.belongsTo(Ticket, {
  foreignKey: "ticketId",
});


// ===============================
// User ↔ TicketMessage (Sender)
// ===============================
User.hasMany(TicketMessage, {
  foreignKey: "senderId",
});

TicketMessage.belongsTo(User, {
  foreignKey: "senderId",
});


// ===============================
// Message ↔ Attachment
// ===============================
TicketMessage.hasMany(TicketAttachment, {
  foreignKey: "messageId",
});

TicketAttachment.belongsTo(TicketMessage, {
  foreignKey: "messageId",
});


// ===============================
// Ticket ↔ Attachment
// ===============================
Ticket.hasMany(TicketAttachment, {
  foreignKey: "ticketId",
});

TicketAttachment.belongsTo(Ticket, {
  foreignKey: "ticketId",
});


// ===============================
// Ticket ↔ History
// ===============================
Ticket.hasMany(TicketHistory, {
  foreignKey: "ticketId",
});

TicketHistory.belongsTo(Ticket, {
  foreignKey: "ticketId",
});


// ===============================
// Ticket ↔ Internal Notes
// ===============================
Ticket.hasMany(TicketInternalNote, {
  foreignKey: "ticketId",
});

TicketInternalNote.belongsTo(Ticket, {
  foreignKey: "ticketId",
});


module.exports = {
  User,
  Ticket,
  TicketMessage,
  TicketAttachment,
  TicketHistory,
  TicketInternalNote,
};