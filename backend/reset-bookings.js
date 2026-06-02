const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const n = await prisma.booking.deleteMany({});
  console.log('deleted bookings:', n.count);
  await prisma.$disconnect();
})();
