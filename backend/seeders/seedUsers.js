require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Ensure tables exist without dropping any data
    await sequelize.sync({ force: false });

    const email = 'admin@hospital.com';
    const passwordHash = await bcrypt.hash('Admin@2025', 12);

    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        name: 'Dr. Sarah Admin',
        email,
        password_hash: passwordHash,
        role: 'admin',
        department: 'Administration',
        is_active: true
      }
    });

    if (created) {
      console.log('✅ Admin user created');
    } else {
      // Update password and role in case they drifted
      await user.update({ password_hash: passwordHash, role: 'admin', is_active: true });
      console.log('ℹ️  Admin already exists — password & role refreshed');
    }

    console.log('─────────────────────────────────');
    console.log('  Email:    admin@hospital.com');
    console.log('  Password: Admin@2025');
    console.log('  Role:     admin');
    console.log('─────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  }
}

seedUsers();
