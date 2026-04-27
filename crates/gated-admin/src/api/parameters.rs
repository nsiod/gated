use gated_common::GatedError;
use gated_core::Services;
use gated_db_entities::Parameters;
use poem::web::Data;
use poem_openapi::payload::Json;
use poem_openapi::{ApiResponse, Object, OpenApi};
use sea_orm::ActiveValue::NotSet;
use sea_orm::{EntityTrait, IntoActiveModel, Set};
use serde::Serialize;

use super::AnySecurityScheme;

pub struct Api;

#[derive(Serialize, Object)]
struct ParameterValues {
    pub allow_own_credential_management: bool,
    pub rate_limit_bytes_per_second: Option<u32>,
    pub ssh_client_auth_publickey: bool,
    pub ssh_client_auth_password: bool,
    pub ssh_client_auth_keyboard_interactive: bool,
    pub minimize_password_login: bool,
    /// Per-user request/minute limit for SQL Console and DB Terminal
    /// gateway endpoints. `None` means unlimited.
    pub sql_console_rate_limit_per_user: Option<u32>,
    /// Per-target request/minute limit for SQL Console and DB Terminal
    /// gateway endpoints. `None` means unlimited.
    pub sql_console_rate_limit_per_target: Option<u32>,
}

#[derive(Serialize, Object)]
struct ParameterUpdate {
    pub allow_own_credential_management: bool,
    pub rate_limit_bytes_per_second: Option<u32>,
    pub ssh_client_auth_publickey: Option<bool>,
    pub ssh_client_auth_password: Option<bool>,
    pub ssh_client_auth_keyboard_interactive: Option<bool>,
    pub minimize_password_login: Option<bool>,
    /// Per-user request/minute limit for SQL Console and DB Terminal
    /// gateway endpoints. `None` clears the limit.
    #[oai(default)]
    pub sql_console_rate_limit_per_user: Option<u32>,
    /// Per-target request/minute limit for SQL Console and DB Terminal
    /// gateway endpoints. `None` clears the limit.
    #[oai(default)]
    pub sql_console_rate_limit_per_target: Option<u32>,
}

#[derive(ApiResponse)]
enum GetParametersResponse {
    #[oai(status = 200)]
    Ok(Json<ParameterValues>),
}

#[derive(ApiResponse)]
enum UpdateParametersResponse {
    #[oai(status = 201)]
    Done,
}

#[OpenApi]
impl Api {
    #[oai(path = "/parameters", method = "get", operation_id = "get_parameters")]
    async fn api_get(
        &self,
        services: Data<&Services>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<GetParametersResponse, GatedError> {
        let db = services.db.read().await;
        let parameters = Parameters::Entity::get(&db).await?;

        Ok(GetParametersResponse::Ok(Json(ParameterValues {
            allow_own_credential_management: parameters.allow_own_credential_management,
            rate_limit_bytes_per_second: parameters.rate_limit_bytes_per_second.map(|x| x as u32),
            ssh_client_auth_publickey: parameters.ssh_client_auth_publickey,
            ssh_client_auth_password: parameters.ssh_client_auth_password,
            ssh_client_auth_keyboard_interactive: parameters.ssh_client_auth_keyboard_interactive,
            minimize_password_login: parameters.minimize_password_login,
            sql_console_rate_limit_per_user: parameters
                .sql_console_rate_limit_per_user
                .map(|x| x as u32),
            sql_console_rate_limit_per_target: parameters
                .sql_console_rate_limit_per_target
                .map(|x| x as u32),
        })))
    }

    #[oai(
        path = "/parameters",
        method = "put",
        operation_id = "update_parameters"
    )]
    async fn api_update_parameters(
        &self,
        services: Data<&Services>,
        body: Json<ParameterUpdate>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<UpdateParametersResponse, GatedError> {
        let db = services.db.read().await;
        let mut parameters = Parameters::Entity::get(&db).await?.into_active_model();

        parameters.allow_own_credential_management = Set(body.allow_own_credential_management);
        parameters.rate_limit_bytes_per_second =
            Set(body.rate_limit_bytes_per_second.map(|x| x as i64));
        parameters.ssh_client_auth_publickey = body.ssh_client_auth_publickey.map_or(NotSet, Set);
        parameters.ssh_client_auth_password = body.ssh_client_auth_password.map_or(NotSet, Set);
        parameters.ssh_client_auth_keyboard_interactive = body
            .ssh_client_auth_keyboard_interactive
            .map_or(NotSet, Set);
        parameters.minimize_password_login = body.minimize_password_login.map_or(NotSet, Set);
        parameters.sql_console_rate_limit_per_user =
            Set(body.sql_console_rate_limit_per_user.map(|x| x as i64));
        parameters.sql_console_rate_limit_per_target =
            Set(body.sql_console_rate_limit_per_target.map(|x| x as i64));

        Parameters::Entity::update(parameters).exec(&*db).await?;
        drop(db);

        services
            .rate_limiter_registry
            .lock()
            .await
            .apply_new_rate_limits(&mut *services.state.write().await)
            .await?;
        services
            .sql_console_rate_limiter
            .refresh(&services.db)
            .await?;

        Ok(UpdateParametersResponse::Done)
    }
}
