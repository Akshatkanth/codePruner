/**
 * Mongoose Models for CodePruner
 */

const mongoose = require('mongoose');

// Project Schema - stores projects and their API keys
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    apiSecret: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// EndpointLog Schema - stores API endpoint usage logs
const endpointLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      uppercase: true
    },
    route: {
      type: String,
      required: true,
      index: true
    },
    statusCode: {
      type: Number,
      required: true,
      min: 100,
      max: 599
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    latency: {
      type: Number,
      default: 0
    }
  },
  { timestamps: false }
);

// Create compound index for efficient querying
endpointLogSchema.index({ projectId: 1, route: 1 });
endpointLogSchema.index({ projectId: 1, timestamp: 1 });

// EndpointStatus Schema - stores analysis results
const endpointStatusSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      uppercase: true
    },
    route: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['dead', 'risky', 'active'],
      default: 'active',
      index: true
    },
    callCount: {
      type: Number,
      default: 0,
      index: true
    },
    lastCalledAt: {
      type: Date,
      default: null
    },
    analyzedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

// Create compound index for projectId + route
endpointStatusSchema.index({ projectId: 1, route: 1 });
endpointStatusSchema.index({ projectId: 1, status: 1 });

// Models
const Project = mongoose.model('Project', projectSchema);
const EndpointLog = mongoose.model('EndpointLog', endpointLogSchema);
const EndpointStatus = mongoose.model('EndpointStatus', endpointStatusSchema);

module.exports = {
  Project,
  EndpointLog,
  EndpointStatus
};
