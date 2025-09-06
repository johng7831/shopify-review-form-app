import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shopify-form-app';

// Connect to MongoDB
export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Form submission schema (supports both contact form and product reviews)
const formSubmissionSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  message: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  productId: {
    type: String,
    trim: true
  },
  productTitle: {
    type: String,
    trim: true
  },
  image: {               // Use 'image' to match backend field
    type: String,
    trim: true,
    default: null
  },
  shop: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export the model
export const FormSubmission = mongoose.model('FormSubmission', formSubmissionSchema);
