const authLoginController = require('./authLoginController');
const authRegisterController = require('./authRegisterController');
const authProfileController = require('./authProfileController');

module.exports = {
    login: authLoginController.login,
    register: authRegisterController.register,
    getProfile: authProfileController.getProfile,
    updateProfile: authProfileController.updateProfile,
    changePassword: authProfileController.changePassword
};
