import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Check if the cookie exists
  const token = req.cookies.tradeflow_jwt;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. Please log in.' });
  }

  try {
    // Verify the token using our secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the user info to the request so our controllers can use it
    req.user = decoded; 
    next(); // Let them through!
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
  }
};