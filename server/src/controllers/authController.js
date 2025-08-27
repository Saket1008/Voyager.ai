import User from '../models/User.js';

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password required' });
  }
  const user = await User.findOne({ email });
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ message: 'invalid credentials' });
  }
  res.json({ message: 'logged in', user: { id: user._id, name: user.name, email: user.email } });
};

