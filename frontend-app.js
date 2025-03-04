// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import CategoryManager from './components/CategoryManager';
import AppDrawer from './components/AppDrawer';
import AppBar from './components/AppBar';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { SnackbarProvider } from './contexts/SnackbarContext';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
});

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <AuthProvider>
          <Router>
            <div style={{ display: 'flex' }}>
              <AppBar toggleDrawer={toggleDrawer} />
              <AppDrawer open={drawerOpen} onClose={toggleDrawer} />
              <main style={{ flexGrow: 1, padding: 24, marginTop: 64 }}>
                <Switch>
                  <Route exact path="/" component={Login} />
                  <PrivateRoute path="/dashboard" component={Dashboard} />
                  <PrivateRoute path="/expenses" component={ExpenseList} />
                  <PrivateRoute path="/categories" component={CategoryManager} />
                  <Redirect to="/" />
                </Switch>
              </main>
            </div>
          </Router>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

// Private route component to handle auth protection
const PrivateRoute = ({ component: Component, ...rest }) => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect to="/" />
        )
      }
    />
  );
};

export default App;