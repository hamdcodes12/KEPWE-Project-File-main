const bcrypt = require('bcryptjs');
const hash = '$2a$10$Esimx1gYDejAP3c.OjpE7uQJwO.6MohyxVyDiKDFiPM9RZGhp5Xcy';
bcrypt.compare('admin123', hash).then((ok) => {
  console.log('admin123 matches stored hash:', ok);
});
