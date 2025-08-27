import User from '../models/User.js';

export const getUsers = async (_req, res) => {
  const users = await User.find().select('-passwordHash');
  res.json(users);
};

export const createUser = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, password required' });
  }
  // WARNING: For demo purposes only; do NOT store raw passwords.
  const user = await User.create({ name, email, passwordHash: password });
  res.status(201).json({ id: user._id, name: user.name, email: user.email });
};

