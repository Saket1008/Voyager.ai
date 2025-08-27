import mongoose from 'mongoose';

export const connectToDatabase = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }
  try {
    await mongoose.connect(mongoUri);
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default mongoose;

