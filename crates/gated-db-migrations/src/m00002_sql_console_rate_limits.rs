use sea_orm_migration::prelude::*;

/// Adds per-user and per-target request-rate limits for the SQL Console /
/// DB Terminal gateway endpoints.
///
/// Both columns default to NULL which preserves the pre-migration behaviour
/// of "no rate limit". Operators opt in by setting the columns via the admin
/// Parameters endpoint.
pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m00002_sql_console_rate_limits"
    }
}

#[derive(Iden)]
enum Parameters {
    Table,
    SqlConsoleRateLimitPerUser,
    SqlConsoleRateLimitPerTarget,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Parameters::Table)
                    .add_column(
                        ColumnDef::new(Parameters::SqlConsoleRateLimitPerUser)
                            .big_integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Parameters::Table)
                    .add_column(
                        ColumnDef::new(Parameters::SqlConsoleRateLimitPerTarget)
                            .big_integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Parameters::Table)
                    .drop_column(Parameters::SqlConsoleRateLimitPerTarget)
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Parameters::Table)
                    .drop_column(Parameters::SqlConsoleRateLimitPerUser)
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}
