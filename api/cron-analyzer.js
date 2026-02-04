/**
 * Cron Job - Daily Endpoint Analysis
 * Detects unused API endpoints for each project
 */

const cron = require('node-cron');
const { EndpointLog, EndpointStatus, Project, User } = require('./models');

/**
 * Clean old logs based on user plan
 * Free: 30 days, Pro: 90 days
 */
async function cleanOldLogs() {
  try {
    console.log('  🧹 Cleaning old logs based on plan...');
    
    // Get all active projects with their owners
    const projects = await Project.find({ active: true }).populate('owner');
    
    let deletedCount = 0;

    for (const project of projects) {
      if (!project.owner) continue;

      const retentionDays = project.owner.plan === 'pro' ? 90 : 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete logs older than cutoff date
      const result = await EndpointLog.deleteMany({
        projectId: project._id,
        timestamp: { $lt: cutoffDate }
      });

      if (result.deletedCount > 0) {
        deletedCount += result.deletedCount;
        console.log(
          `     Deleted ${result.deletedCount} logs for project "${project.name}" ` +
          `(${project.owner.plan} plan, retention: ${retentionDays} days)`
        );
      }
    }

    if (deletedCount > 0) {
      console.log(`  ✅ Deleted ${deletedCount} total old log(s)`);
    }
  } catch (error) {
    console.error('  ❌ Error cleaning old logs:', error.message);
  }
}

/**
 * Analyze endpoints for a specific project
 */
async function analyzeProject(projectId) {
  try {
    const mongoose = require('mongoose');
    
    // Convert string to ObjectId if needed
    const objectId = typeof projectId === 'string' 
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Aggregation pipeline to analyze endpoint usage
    const pipeline = [
      // Match logs from last 60 days for this project
      {
        $match: {
          projectId: objectId,
          timestamp: { $gte: sixtyDaysAgo }
        }
      },
      // Group by method + route
      {
        $group: {
          _id: {
            method: '$method',
            route: '$route'
          },
          callCount: { $sum: 1 },
          lastCalledAt: { $max: '$timestamp' }
        }
      },
      // Sort by call count descending
      {
        $sort: { callCount: -1 }
      }
    ];

    const results = await EndpointLog.aggregate(pipeline);

    console.log(`  Aggregation returned ${results.length} results`);

    // Determine status and prepare documents for insertion
    const statusDocuments = results.map(result => {
      let status = 'active';
      
      if (result.callCount === 0) {
        status = 'dead';
      } else if (result.callCount < 5) {
        status = 'risky';
      }

      return {
        projectId: objectId,
        method: result._id.method,
        route: result._id.route,
        status,
        callCount: result.callCount,
        lastCalledAt: result.lastCalledAt,
        analyzedAt: new Date()
      };
    });

    if (statusDocuments.length === 0) {
      console.log(`  No endpoints found for project ${projectId}`);
      return 0;
    }

    // Delete previous results for this project
    await EndpointStatus.deleteMany({ projectId: objectId });

    // Insert new results
    await EndpointStatus.insertMany(statusDocuments);

    console.log(`  ✅ Analyzed ${statusDocuments.length} endpoints for project ${projectId}`);

    // Print summary
    const summary = {
      dead: statusDocuments.filter(d => d.status === 'dead').length,
      risky: statusDocuments.filter(d => d.status === 'risky').length,
      active: statusDocuments.filter(d => d.status === 'active').length
    };

    console.log(`     - Dead: ${summary.dead}, Risky: ${summary.risky}, Active: ${summary.active}`);

    return statusDocuments.length;
  } catch (error) {
    console.error(`❌ Error analyzing project ${projectId}:`, error.message);
    console.error(error.stack);
    return 0;
  }
}

/**
 * Run daily analysis for all active projects
 */
async function runDailyAnalysis() {
  try {
    console.log(`\n📊 Starting daily maintenance job (${new Date().toISOString()})`);

    // Step 1: Clean old logs based on plan
    await cleanOldLogs();

    // Step 2: Run endpoint analysis
    console.log('  📈 Running endpoint analysis...');

    // Get all active projects
    const projects = await Project.find({ active: true });

    if (projects.length === 0) {
      console.log('  No active projects found');
      return;
    }

    console.log(`  Found ${projects.length} active project(s)`);

    let totalEndpoints = 0;

    // Analyze each project
    for (const project of projects) {
      console.log(`  Analyzing project: ${project.name}`);
      const count = await analyzeProject(project._id);
      totalEndpoints += count;
    }

    console.log(`✅ Daily maintenance complete. Total endpoints analyzed: ${totalEndpoints}\n`);
  } catch (error) {
    console.error('❌ Daily maintenance error:', error);
  }
}

/**
 * Schedule cron job - runs daily at 2 AM
 */
function scheduleCronJob() {
  // Schedule for 2 AM every day (adjust as needed)
  // Format: minute hour day month day-of-week
  const job = cron.schedule('0 2 * * *', async () => {
    await runDailyAnalysis();
  });

  console.log('🕐 Cron job scheduled: Daily analysis at 2:00 AM');
  return job;
}

/**
 * Manual trigger for testing
 */
async function runAnalysisNow() {
  await runDailyAnalysis();
}

module.exports = {
  scheduleCronJob,
  runAnalysisNow,
  analyzeProject,
  cleanOldLogs
};
