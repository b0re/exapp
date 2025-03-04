// src/components/AppBar.js
import React from 'react';
import { useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Avatar,
  Menu,
  MenuItem,
} from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const useStyles = makeStyles((theme) => ({
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  title: {
    flexGrow: 1,
  },
  avatar: {
    marginRight: theme.spacing(1),
  },
}));

function AppBar({ toggleDrawer }) {
  const classes = useStyles();
  const history = useHistory();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  const [anchorEl, setAnchorEl] = React.useState(null);
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    logout();
    showSnackbar('You have been logged out', 'info');
    history.push('/');
    handleMenuClose();
  };
  
  return (
    <MuiAppBar position="fixed" className={classes.appBar}>
      <Toolbar>
        {isAuthenticated && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        <Typography variant="h6" className={classes.title} onClick={() => history.push('/')}>
          Expense Tracker
        </Typography>
        
        {isAuthenticated && currentUser ? (
          <>
            <Avatar
              alt={currentUser.name}
              src={currentUser.imageUrl}
              className={classes.avatar}
              onClick={handleMenuOpen}
            />
            <Button color="inherit" onClick={handleMenuOpen}>
              {currentUser.name}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => {
                history.push('/dashboard');
                handleMenuClose();
              }}>
                Dashboard
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </>
        ) : (
          <Button color="inherit" onClick={() => history.push('/')}>
            Login
          </Button>
        )}
      </Toolbar>
    </MuiAppBar>
  );
}

export default AppBar;

// src/components/AppDrawer.js
import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Hidden,
} from '@material-ui/core';
import DashboardIcon from '@material-ui/icons/Dashboard';
import ListAltIcon from '@material-ui/icons/ListAlt';
import CategoryIcon from '@material-ui/icons/Category';
import ReceiptIcon from '@material-ui/icons/Receipt';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  toolbar: theme.mixins.toolbar,
  activeItem: {
    backgroundColor: theme.palette.action.selected,
  },
}));

function AppDrawer({ open, onClose }) {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
    },
    {
      text: 'Expenses',
      icon: <ListAltIcon />,
      path: '/expenses',
    },
    {
      text: 'Categories',
      icon: <CategoryIcon />,
      path: '/categories',
    },
  ];
  
  const handleNavigation = (path) => {
    history.push(path);
    onClose();
  };
  
  const drawerContent = (
    <>
      <div className={classes.toolbar} />
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => handleNavigation(item.path)}
            className={location.pathname === item.path ? classes.activeItem : ''}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </>
  );
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <>
      <Hidden smUp>
        <Drawer
          className={classes.drawer}
          variant="temporary"
          anchor="left"
          open={open}
          onClose={onClose}
          classes={{
            paper: classes.drawerPaper,
          }}
        >
          {drawerContent}
        </Drawer>
      </Hidden>
      <Hidden xsDown>
        <Drawer
          className={classes.drawer}
          variant="permanent"
          classes={{
            paper: classes.drawerPaper,
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Hidden>
    </>
  );
}

export default AppDrawer;