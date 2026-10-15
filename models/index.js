const User = require("./User");
const Domain = require("./domains/domains.model");
const EmailPage = require("./EmailPage");
const { Ticket, TicketMessage, TicketAttachment, TicketHistory, TicketInternalNote } = require("./ticket");
const Plan = require("./Plan");
const Payment = require("./Payment");
const Subscription = require("./Subscription");
const AuditLog = require("./AuditLog");

// User <-> Domain
if (!User.associations.domains) {
  User.hasMany(Domain, { foreignKey: "userId", as: "domains" });
}
if (!Domain.associations.user) {
  Domain.belongsTo(User, { foreignKey: "userId", as: "user" });
}

// User <-> EmailPage
if (!User.associations.emailPages) {
  User.hasMany(EmailPage, { foreignKey: "userId", as: "emailPages" });
}
if (!EmailPage.associations.user) {
  EmailPage.belongsTo(User, { foreignKey: "userId", as: "user" });
}

// User <-> Ticket
if (!User.associations.tickets) {
  User.hasMany(Ticket, { foreignKey: "userId", as: "tickets" });
}
if (!Ticket.associations.user) {
  Ticket.belongsTo(User, { foreignKey: "userId", as: "user" });
}

// User <-> Subscription
if (!User.associations.subscriptions) {
  User.hasMany(Subscription, { foreignKey: "userId", as: "subscriptions" });
}
if (!Subscription.associations.user) {
  Subscription.belongsTo(User, { foreignKey: "userId", as: "user" });
}

// User <-> Payment (by email)
if (!User.associations.payments) {
  User.hasMany(Payment, { foreignKey: "email", sourceKey: "email", as: "payments" });
}
if (!Payment.associations.user) {
  Payment.belongsTo(User, { foreignKey: "email", targetKey: "email", as: "user" });
}

module.exports = {
  User,
  Domain,
  EmailPage,
  Ticket,
  TicketMessage,
  TicketAttachment,
  TicketHistory,
  TicketInternalNote,
  Plan,
  Payment,
  Subscription,
  AuditLog,
};

