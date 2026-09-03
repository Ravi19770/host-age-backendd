const {
  Ticket,
  TicketMessage,
  TicketAttachment,
  TicketHistory,
  TicketInternalNote,
  User,
} = require("../models/ticket");

class TicketRepository {
  /**
   * Create Ticket
   */
  async createTicket(data) {
    return await Ticket.create(data);
  }

  /**
   * Find Ticket By ID
   */
  async findById(id) {
  return await Ticket.findByPk(id, {
    include: [
      {
        model: User,
        attributes: ["id", "fullName", "email"],
      },
      {
        model: TicketMessage,
        include: [
          {
            model: TicketAttachment,
          },
        ],
      },
      {
        model: TicketHistory,
      },
      {
        model: TicketInternalNote,
      },
    ],
    order: [
      [TicketMessage, "createdAt", "ASC"],
      [TicketHistory, "createdAt", "DESC"],
      [TicketInternalNote, "createdAt", "DESC"],
    ],
  });
}

  /**
   * Get All Tickets
   */
  async getAllTickets(filters = {}) {
    return await Ticket.findAll({
      where: filters,
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Find By Ticket Number
   */
  async findByTicketNumber(ticketNumber) {
    return await Ticket.findOne({
      where: {
        ticketNumber,
      },
    });
  }

  /**
   * Update Ticket
   */
  async updateTicket(id, data) {
    await Ticket.update(data, {
      where: { id },
    });

    return this.findById(id);
  }

  /**
   * Delete Ticket
   */
  async deleteTicket(id) {
    return await Ticket.destroy({
      where: { id },
    });
  }

  /**
   * Count Tickets
   */
  async count(filters = {}) {
    return await Ticket.count({
      where: filters,
    });
  }

  /**
   * Create Message
   */
  async createMessage(data) {
    return await TicketMessage.create(data);
  }

  /**
   * Get Messages
   */
  async getMessages(ticketId) {
    return await TicketMessage.findAll({
      where: { ticketId },
      order: [["createdAt", "ASC"]],
    });
  }

  /**
   * Create Attachment
   */
  async createAttachment(data) {
    return await TicketAttachment.create(data);
  }

  /**
   * Get Attachments
   */
  async getAttachments(messageId) {
    return await TicketAttachment.findAll({
      where: { messageId },
    });
  }

  /**
   * Create History
   */
  async createHistory(data) {
    return await TicketHistory.create(data);
  }

  /**
   * Get History
   */
  async getHistory(ticketId) {
    return await TicketHistory.findAll({
      where: { ticketId },
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Add Internal Note
   */
  async addInternalNote(data) {
    return await TicketInternalNote.create(data);
  }

  /**
   * Get Internal Notes
   */
  async getInternalNotes(ticketId) {
    return await TicketInternalNote.findAll({
      where: { ticketId },
      order: [["createdAt", "DESC"]],
    });
  }
}

module.exports = new TicketRepository();