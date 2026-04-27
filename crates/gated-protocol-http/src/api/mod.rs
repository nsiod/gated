use poem_openapi::OpenApi;

mod api_tokens;
pub mod auth;
mod common;
mod credentials;
pub(crate) mod db_query;
pub mod info;
pub mod sso_provider_detail;
pub mod sso_provider_list;
pub mod targets_list;
mod tickets;
// Not part of OpenAPI — WebSocket upgrade is not representable in poem-openapi.
// These endpoints are mounted with raw `#[handler]` in `lib.rs`:
//   /api/ssh/terminal/:target_name
//   /api/mysql/terminal/:target_name
//   /api/postgres/terminal/:target_name
pub(crate) mod db_terminal;
pub(crate) mod sql_validation;
pub(crate) mod ssh_terminal;

pub use gated_common::api::AnySecurityScheme;

pub fn get() -> impl OpenApi {
    (
        auth::Api,
        info::Api,
        targets_list::Api,
        sso_provider_list::Api,
        sso_provider_detail::Api,
        credentials::Api,
        api_tokens::Api,
        tickets::Api,
        db_query::Api,
    )
}
