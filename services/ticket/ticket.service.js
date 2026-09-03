const ticketRepository = require("../../repositories/ticket.repository");

class TicketService {
  /**
   * Generate Ticket Number
   * Example: TK-20260721-0001
   */
  generateTicketNumber() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const random = Math.floor(1000 + Math.random() * 9000);

    return `TK-${year}${month}${day}-${random}`;
  }

  /**
   * Create Ticket
   */
  /**
 * Create Ticket
 */
  async createTicket(data, attachments = []) {
    try {
      console.log("STEP 1");

      const ticket = await ticketRepository.createTicket({
        ...data,
        ticketNumber: this.generateTicketNumber(),
        status: "Open",
      });

      console.log(ticket.toJSON());

      const firstMessage = await ticketRepository.createMessage({
        ticketId: ticket.id,
        senderId: data.userId,
        senderType: "Customer",
        message: data.description,
      });

      console.log("STEP 3", firstMessage.id);

      if (attachments.length) {
        for (const file of attachments) {
          console.log("STEP 4");

          await ticketRepository.createAttachment({
            ticketId: ticket.id,
            messageId: firstMessage.id,
            fileName: file.originalname,
            filePath: file.filename,
            fileType: file.mimetype,
            fileSize: file.size,
          });

          console.log("STEP 5");
        }
      }

      console.log("STEP 6");

      return ticket;

    } catch (err) {
      console.error("SERVICE ERROR:", err);
      throw err;
    }
  }
  /**
   * Get All Tickets
   */
  async getTickets(filters = {}) {
    return await ticketRepository.getAllTickets(filters);
  }
  async getTicket(ticketId) {
  const ticket = await ticketRepository.findById(ticketId);

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return ticket;
}

  /**
   * Reply Ticket
   */
  async replyTicket(ticketId, data) {
    const ticket = await ticketRepository.findById(ticketId);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const message = await ticketRepository.createMessage({
      ticketId,
      senderId: data.senderId,
      senderType: data.senderType,
      message: data.message,
    });

    await ticketRepository.createHistory({
      ticketId,
      action: "New Reply",
      oldValue: null,
      newValue: "Reply Added",
      performedBy: data.senderId,
    });

    return message;
  }

  /**
   * Update Ticket
   */
  async updateTicket(ticketId, updates, performedBy) {
    const ticket = await ticketRepository.findById(ticketId);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const oldStatus = ticket.status;

    const updated = await ticketRepository.updateTicket(
      ticketId,
      updates
    );

    if (
      updates.status &&
      updates.status !== oldStatus
    ) {
      await ticketRepository.createHistory({
        ticketId,
        action: "Status Changed",
        oldValue: oldStatus,
        newValue: updates.status,
        performedBy,
      });
    }

    return updated;
  }

  /**
   * Assign Agent
   */
  async assignAgent(ticketId, agentId, adminId) {
    const updated = await ticketRepository.updateTicket(
      ticketId,
      {
        assignedAgentId: agentId,
      }
    );

    await ticketRepository.createHistory({
      ticketId,
      action: "Agent Assigned",
      oldValue: null,
      newValue: agentId,
      performedBy: adminId,
    });

    return updated;
  }

  /**
   * Internal Note
   */
  async addInternalNote(ticketId, adminId, note) {
    return await ticketRepository.addInternalNote({
      ticketId,
      adminId,
      note,
    });
  }

  /**
   * Delete Ticket
   */
  async deleteTicket(ticketId) {
    return await ticketRepository.deleteTicket(ticketId);
  }
}

module.exports = new TicketService();