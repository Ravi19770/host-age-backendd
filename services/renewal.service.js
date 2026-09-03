const Domain = require("../models/Domain");

class RenewalService {
  async getRenewal(domainId, userId) {
    const domain = await Domain.findOne({
      where: {
        id: domainId,
        userId,
      },
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    return {
      autoRenew: domain.autoRenew,
      expiryDate: domain.expiryDate,
      renewalPrice: domain.renewalPrice,
      renewalStatus: domain.renewalStatus,
      nextRenewalDate: domain.nextRenewalDate,
    };
  }

  async updateRenewal(domainId, userId, autoRenew) {
    const domain = await Domain.findOne({
      where: {
        id: domainId,
        userId,
      },
    });

    if (!domain) {
      throw new Error("Domain not found");
    }

    domain.autoRenew = autoRenew;

    await domain.save();

    return domain;
  }
}

module.exports = new RenewalService();