/**
 * Helper script to create a test project with API key
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Project } = require('./models');
const crypto = require('crypto');

async function createTestProject() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codepruner', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('📌 Creating test project...\n');

    // Generate API key and secret
    const apiKey = 'cp_' + crypto.randomBytes(32).toString('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');

    const project = new Project({
      name: 'Test Project',
      apiKey,
      apiSecret,
      description: 'Created for testing CodePruner SDK',
      active: true
    });

    await project.save();

    console.log('✅ Test Project Created!\n');
    console.log('📋 Project Details:');
    console.log(`   Project ID: ${project._id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   API Key: ${apiKey}`);
    console.log(`   Created: ${project.createdAt}\n`);

    console.log('💡 Usage:');
    console.log(`   export CP_API_KEY="${apiKey}"`);
    console.log(`   node ../app.js\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating project:', error.message);
    process.exit(1);
  }
}

createTestProject();
