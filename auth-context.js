// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setCurrentUser(userData);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Handle Google login success
  const handleLoginSuccess = async (response) => {
    try {
      // Get user profile
      const profile = response.profileObj;
      
      // Get auth tokens
      const tokens = response.tokenObj;
      
      // Send to backend for verification and DB storage
      const serverResponse = await axios.post('/api/auth/google', {
        email: profile.email,
        refresh_token: tokens.refresh_token,
      });
      
      if (serverResponse.data.success) {
        // Create user object
        const user = {
          id: serverResponse.data.user_id,
          name: profile.name,
          email: profile.email,
          imageUrl: profile.imageUrl,
        };
        
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update state
        setCurrentUser(user);
        setIsAuthenticated(true);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  // Handle logout
  const logout = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    currentUser,
    isAuthenticated,
    handleLoginSuccess,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// src/components/Login.js
import React from 'react';
import { useHistory } from 'react-router-dom';
import GoogleLogin from 'react-google-login';
import { makeStyles } from '@material-ui/core/styles';
import { Container, Paper, Typography, Button, Box } from '@material-ui/core';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const useStyles = makeStyles((theme) => ({
  container: {
    marginTop: theme.spacing(8),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  paper: {
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 500,
  },
  title: {
    marginBottom: theme.spacing(3),
  },
  subtitle: {
    marginBottom: theme.spacing(4),
    textAlign: 'center',
  },
  loginButton: {
    marginTop: theme.spacing(2),
  },
}));

function Login() {
  const classes = useStyles();
  const history = useHistory();
  const { handleLoginSuccess, isAuthenticated } = useAuth();
  const { showSnackbar } = useSnackbar();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      history.push('/dashboard');
    }
  }, [isAuthenticated, history]);

  const onLoginSuccess = async (response) => {
    const success = await handleLoginSuccess(response);
    if (success) {
      showSnackbar('Login successful!', 'success');
      history.push('/dashboard');
    } else {
      showSnackbar('Login failed. Please try again.', 'error');
    }
  };

  const onLoginFailure = (error) => {
    console.error('Login failure:', error);
    showSnackbar('Login failed. Please try again.', 'error');
  };

  return (
    <Container component="main" className={classes.container}>
      <Paper elevation={3} className={classes.paper}>
        <Typography component="h1" variant="h4" className={classes.title}>
          Expense Tracker
        </Typography>
        <Typography variant="body1" color="textSecondary" className={classes.subtitle}>
          Track your expenses automatically by connecting your Gmail account
        </Typography>
        
        <Box mt={2} width="100%">
          <GoogleLogin
            clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}
            buttonText="Sign in with Google"
            onSuccess={onLoginSuccess}
            onFailure={onLoginFailure}
            cookiePolicy={'single_host_origin'}
            scope="https://www.googleapis.com/auth/gmail.readonly profile email"
            accessType="offline"
            responseType="code"
            prompt="consent"
            className={classes.loginButton}
            render={(renderProps) => (
              <Button
                onClick={renderProps.onClick}
                disabled={renderProps.disabled}
                variant="contained"
                color="primary"
                fullWidth
                className={classes.loginButton}
              >
                Sign in with Google
              </Button>
            )}
          />
        </Box>
        
        <Box mt={4}>
          <Typography variant="body2" color="textSecondary" align="center">
            By signing in, you authorize this app to read your Gmail emails to extract purchase information.
            We only access emails related to purchases and never store the email content itself.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default Login;

// src/contexts/SnackbarContext.js
import React, { createContext, useState, useContext } from 'react';
import { Snackbar } from '@material-ui/core';
import { Alert } from '@material-ui/lab';

const SnackbarContext = createContext();

export const useSnackbar = () => useContext(SnackbarContext);

export const SnackbarProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');

  const showSnackbar = (msg, sev = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar open={open} autoHideDuration={5000} onClose={handleClose}>
        <Alert onClose={handleClose} severity={severity}>
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};
