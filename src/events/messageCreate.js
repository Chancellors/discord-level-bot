const { grantTextXP } = require('../systems/xpEngine');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    await grantTextXP(message, client);
  },
};
