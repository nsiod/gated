use std::sync::Arc;

use gated_common::GatedError;
use poem::web::Data;
use poem_openapi::param::Path;
use poem_openapi::{ApiResponse, OpenApi};
use sea_orm::{DatabaseConnection, EntityTrait, ModelTrait};
use tokio::sync::RwLock;
use uuid::Uuid;

use super::AnySecurityScheme;
pub struct Api;

#[derive(ApiResponse)]
enum DeleteSSHKnownHostResponse {
    #[oai(status = 204)]
    Deleted,

    #[oai(status = 404)]
    NotFound,
}

#[OpenApi]
impl Api {
    #[oai(
        path = "/ssh/known-hosts/:id",
        method = "delete",
        operation_id = "delete_ssh_known_host"
    )]
    async fn api_ssh_delete_known_host(
        &self,
        db: Data<&Arc<RwLock<DatabaseConnection>>>,
        id: Path<Uuid>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<DeleteSSHKnownHostResponse, GatedError> {
        use gated_db_entities::KnownHost;
        let db = db.read().await;

        let known_host = KnownHost::Entity::find_by_id(id.0).one(&*db).await?;

        match known_host {
            Some(known_host) => {
                known_host.delete(&*db).await?;
                Ok(DeleteSSHKnownHostResponse::Deleted)
            }
            None => Ok(DeleteSSHKnownHostResponse::NotFound),
        }
    }
}
