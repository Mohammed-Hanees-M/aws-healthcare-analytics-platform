require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function seedAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Sync only (no force drop) to ensure the users table exists
    await sequelize.sync({ force: false });

    const email = 'admin@hospital.com';
    const password = 'Admin@123';
    const passwordHash = await bcrypt.hash(password, 12);

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

    if (!created) {
      // User already exists — update the password to the expected value
      await user.update({ password_hash: passwordHash, is_active: true, role: 'admin' });
      console.log('🔄 Admin user already existed — password & role updated.');
    } else {
      console.log('✅ Admin user created successfully.');
    }

    console.log('─────────────────────────────────');
    console.log('Admin credentials:');
    console.log('  Email:    admin@hospital.com');
    console.log('  Password: Admin@123');
    console.log('  Role:     admin');
    console.log('─────────────────────────────────');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedAdmin();
