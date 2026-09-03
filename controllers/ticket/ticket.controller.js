const ticketService = require("../../services/ticket/ticket.service");
/**
    * POST /api/tickets
    */
class TicketController {
    async createTicket(req, res) {
        try {
            const ticket = await ticketService.createTicket(
                {
                    ...req.body,
                    userId: req.user.id,
                },
                req.files || []
            );

            console.log("===== CONTROLLER =====");
            console.log(ticket);
            console.log(ticket?.toJSON?.());

            return res.status(201).json({
                success: true,
                message: "Ticket created successfully",
                ticket,
            });
        } catch (error) {
            console.error(error);

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }


    /**
     * GET /api/tickets
     */
    async getTickets(req, res) {
        try {
            const tickets = await ticketService.getTickets(req.query);

            return res.json({
                success: true,
                count: tickets.length,
                tickets,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * GET /api/tickets/:id
     */
    async getTicket(req, res) {
        try {
            const ticket = await ticketService.getTicket(req.params.id);

            return res.json({
                success: true,
                ticket,
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * POST /api/tickets/:id/reply
     */
    async replyTicket(req, res) {
        try {
            const message = await ticketService.replyTicket(
                req.params.id,
                {
                    senderId: req.user.id,
                    senderType: req.user.role,
                    message: req.body.message,
                }
            );

            return res.status(201).json({
                success: true,
                message: "Reply added successfully",
                data: message,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * PUT /api/tickets/:id
     */
    async updateTicket(req, res) {
        try {
            const ticket = await ticketService.updateTicket(
                req.params.id,
                req.body,
                req.user.id
            );

            return res.json({
                success: true,
                message: "Ticket updated successfully",
                ticket,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * PUT /api/tickets/:id/assign
     */
    async assignAgent(req, res) {
        try {
            const ticket = await ticketService.createTicket(
                {
                    ...req.body,
                    userId: req.user.id,
                },
                req.files || []
            );

            console.log("RETURNED TICKET =>", ticket);

            return res.status(201).json({
                success: true,
                message: "Ticket created successfully",
                ticket,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * POST /api/tickets/:id/internal-note
     */
    async addInternalNote(req, res) {
        try {
            const note = await ticketService.addInternalNote(
                req.params.id,
                req.user.id,
                req.body.note
            );

            return res.status(201).json({
                success: true,
                message: "Internal note added",
                note,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * DELETE /api/tickets/:id
     */
    async deleteTicket(req, res) {
        try {
            await ticketService.deleteTicket(req.params.id);

            return res.json({
                success: true,
                message: "Ticket deleted successfully",
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

}

module.exports = new TicketController();